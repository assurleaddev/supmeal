/**
 * Génère les captures d'écran du manuel utilisateur en pilotant l'application réelle.
 *
 *   docker compose up -d
 *   docker compose exec server npm run db:seed
 *   cd client && npm run captures
 *
 * Les images sont écrites dans `docs/captures/`. Le script est versionné pour que les captures
 * puissent être régénérées à l'identique après une évolution de l'interface, plutôt que reprises
 * à la main.
 *
 * Deux captures ne peuvent pas être produites ici : l'écran de consentement de Google et celui de
 * GitHub appartiennent à ces fournisseurs et exigent de s'authentifier avec un compte réel.
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const CLIENT = process.env.CAPTURE_URL || 'http://localhost:8080';
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'docs', 'captures');

/** Comptes créés par `npm run db:seed`. */
const DEMO = { email: 'alice@test.com', password: 'password123' };

const DESKTOP = { width: 1440, height: 900 };
const MOBILE = { width: 390, height: 844 };

let count = 0;

/**
 * Les fichiers portent leur seul intitulé, sans numéro d'ordre.
 *
 * Un préfixe numérique paraissait pratique mais rendait le jeu fragile : insérer une capture
 * décalait toutes les suivantes et cassait silencieusement les liens du manuel. L'ordre reste
 * visible dans la sortie console, là où il sert.
 */
async function shoot(page, name, options = {}) {
  count++;
  await page.screenshot({ path: join(OUT, `${name}.png`), ...options });
  console.log(`  ${String(count).padStart(2, '0')}  ${name}`);
}

/** Laisse le temps aux requêtes et aux animations d'entrée de se terminer. */
async function settle(page, ms = 900) {
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(ms);
}

async function login(page) {
  await page.goto(`${CLIENT}/login`, { waitUntil: 'domcontentloaded' });
  await settle(page);
  await page.getByLabel(/adresse e-?mail|email/i).fill(DEMO.email);
  await page.getByLabel(/mot de passe/i).first().fill(DEMO.password);
  await page.getByRole('button', { name: /se connecter/i }).click();
  await page.waitForURL(/\/home/, { timeout: 20000 });
  await settle(page);
}

/**
 * Le jeu de démonstration ne planifie rien sur la semaine en cours : sans contenu, le planning
 * s'affiche vide et le bouton « Liste de courses » n'apparaît pas. On remplit donc la semaine par
 * l'API avant de capturer.
 */
async function fillCurrentWeek() {
  const api = async (path, init) => {
    const response = await fetch(`${CLIENT}/api${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    });
    const body = await response.json().catch(() => null);
    return { status: response.status, body };
  };

  const login = await api('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: DEMO.email, password: DEMO.password }),
  });

  const token = login.body?.data?.accessToken;
  if (!token) {
    // Le motif exact compte : un 429 se règle en redémarrant le serveur, un 401 en rechargeant le
    // jeu de données. Les confondre fait chercher au mauvais endroit.
    const reason =
      login.status === 429
        ? 'la limitation de débit est atteinte — redémarrez le service server pour la réinitialiser'
        : login.status === 401
          ? `le compte ${DEMO.email} est inconnu — lancez « docker compose exec server npm run db:seed »`
          : `réponse HTTP ${login.status} : ${login.body?.message ?? 'inattendue'}`;
    throw new Error(`connexion à l'API impossible — ${reason}`);
  }

  const auth = { Authorization: `Bearer ${token}` };
  const recipes = (await api('/recipes?limit=6', { headers: auth })).body?.data?.items ?? [];
  const week = (await api('/meal-plans/week?offset=0', { headers: auth })).body;
  const days = week?.data?.days ?? [];
  if (recipes.length === 0 || days.length === 0) return;

  // Le script doit pouvoir être relancé : sans purge, chaque exécution empile un second exemplaire
  // de chaque repas dans la grille.
  const existing = week?.data?.plan;
  for (const item of existing?.items ?? []) {
    await api(`/meal-plans/${existing.id}/items/${item.id}`, { method: 'DELETE', headers: auth });
  }

  // Volontairement moins d'entrées que de recettes disponibles : il doit rester des candidates
  // non planifiées, sinon les captures ne montreraient que le cas de repli des suggestions.
  const menu = [
    [days[0], 'LUNCH'],
    [days[2], 'DINNER'],
    [days[6], 'DINNER'],
  ];

  for (const [index, [date, mealType]] of menu.entries()) {
    const recipe = recipes[index % recipes.length];
    await api('/meal-plans/schedule', {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({ recipeId: recipe.id, date, mealType }),
    });
  }

  console.log(`  (semaine courante garnie : ${menu.length} repas)`);
}

async function main() {
  await mkdir(OUT, { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: DESKTOP,
    locale: 'fr-FR',
    timezoneId: 'Europe/Paris',
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  try {
    await fillCurrentWeek();
  console.log('Captures :');

    // ── Page publique et connexion ──
    await page.goto(CLIENT, { waitUntil: 'domcontentloaded' });
    await settle(page, 1400);
    await shoot(page, 'accueil-public');

    await page.goto(`${CLIENT}/login`, { waitUntil: 'domcontentloaded' });
    await settle(page);
    await shoot(page, 'connexion-oauth');

    await page.goto(`${CLIENT}/register`, { waitUntil: 'domcontentloaded' });
    await settle(page);
    await shoot(page, 'inscription');

    // ── Application ──
    await login(page);
    await shoot(page, 'tableau-de-bord');

    await page.goto(`${CLIENT}/recipes`, { waitUntil: 'domcontentloaded' });
    await settle(page);
    await shoot(page, 'liste-recettes-filtres');

    // Recherche insensible aux accents : « creme » doit trouver « Crème ».
    const search = page.getByPlaceholder(/recherch/i).first();
    if (await search.count()) {
      await search.fill('creme');
      await settle(page, 1200);
      await shoot(page, 'recherche-sans-accents');
      await search.fill('');
      await settle(page, 600);
    }

    // Première recette de la liste.
    const firstCard = page.locator('a[href^="/recipes/"]').first();
    if (await firstCard.count()) {
      await firstCard.click();
      await page.waitForURL(/\/recipes\/[^/]+$/, { timeout: 15000 });
      await settle(page);
      await shoot(page, 'fiche-recette', { fullPage: true });
    }

    await page.goto(`${CLIENT}/recipes/new`, { waitUntil: 'domcontentloaded' });
    await settle(page);
    await shoot(page, 'formulaire-recette', { fullPage: true });

    // ── Cookbook partagé ──
    await page.goto(`${CLIENT}/cookbooks`, { waitUntil: 'domcontentloaded' });
    await settle(page);
    await shoot(page, 'liste-cookbooks');

    const firstCookbook = page.locator('a[href^="/cookbooks/"]').first();
    if (await firstCookbook.count()) {
      await firstCookbook.click();
      await page.waitForURL(/\/cookbooks\/[^/]+$/, { timeout: 15000 });
      await settle(page);
      await shoot(page, 'cookbook-recettes');

      for (const [label, name] of [['membres', /membres/i], ['chat', /chat/i]]) {
        const tab = page.getByRole('tab', { name }).first();
        if (await tab.count()) {
          await tab.click();
          await settle(page, 1100);
          await shoot(page, `cookbook-${label}`);
        }
      }
    }

    // ── Planning et liste de courses ──
    await page.goto(`${CLIENT}/meal-planner`, { waitUntil: 'domcontentloaded' });
    await settle(page, 1200);
    await shoot(page, 'planning-hebdomadaire');

    const shoppingList = page.getByRole('button', { name: /liste de courses/i }).first();
    if (await shoppingList.count()) {
      await shoppingList.click();
      await settle(page, 1200);
      await shoot(page, 'liste-de-courses');
      await page.keyboard.press('Escape');
      await settle(page, 500);
    }

    // ── Suggestions pour un créneau ──
    // Ouvrir une case vide du planning déclenche la requête de suggestions ; c'est là que la
    // fonctionnalité se voit.
    // Cibler une case du planning par son nom accessible : un sélecteur d'icône attraperait aussi
    // le bouton « + Recette » de la barre de navigation.
    const addButton = page.getByRole('button', { name: /^Ajouter un d(î|i)ner le/i }).first();
    if (await addButton.count()) {
      await addButton.click();
      // Laisser le temps au classement de revenir avant de capturer.
      await settle(page, 2200);
      await shoot(page, 'suggestions-creneau');
      await page.keyboard.press('Escape');
      await settle(page, 500);
    }

    // ── Paramètres ──
    await page.goto(`${CLIENT}/settings`, { waitUntil: 'domcontentloaded' });
    await settle(page);
    await shoot(page, 'parametres-profil');

    for (const [label, name] of [
      ['preferences', /préférences/i],
      ['connexions', /connexions/i],
    ]) {
      const tab = page.getByRole('tab', { name }).first();
      if (await tab.count()) {
        await tab.click();
        await settle(page, 900);
        await shoot(page, `parametres-${label}`);
      }
    }

    // ── Import / export ──
    await page.goto(`${CLIENT}/data`, { waitUntil: 'domcontentloaded' });
    await settle(page);
    await shoot(page, 'import-export', { fullPage: true });

    // L'avertissement doit être reconnu avant que l'export ne devienne possible.
    const acknowledge = page.getByRole('checkbox').first();
    if (await acknowledge.count()) {
      await acknowledge.check();
      await settle(page, 500);
      await shoot(page, 'export-avertissement-accepte', { fullPage: true });
    }

    // ── Page introuvable ──
    await page.goto(`${CLIENT}/cette-page-nexiste-pas`, { waitUntil: 'domcontentloaded' });
    await settle(page);
    await shoot(page, 'page-404');

    // ── Rendu mobile ──
    await page.setViewportSize(MOBILE);
    await page.goto(`${CLIENT}/home`, { waitUntil: 'domcontentloaded' });
    await settle(page, 1000);
    await shoot(page, 'mobile-tableau-de-bord');

    await page.goto(`${CLIENT}/meal-planner`, { waitUntil: 'domcontentloaded' });
    await settle(page, 1200);
    await shoot(page, 'mobile-planning');

    console.log(`\n${count} captures écrites dans docs/captures/`);

    // Contrôle de cohérence : le manuel ne doit référencer que des fichiers existants, et toute
    // capture produite doit servir. Une rupture doit se voir ici, pas à la relecture du rendu.
    const manual = readFileSync(join(OUT, '..', 'manuel-utilisateur.md'), 'utf8');
    const referenced = [...manual.matchAll(/\]\(captures\/([^)]+)\)/g)].map((m) => m[1]);
    const onDisk = readdirSync(OUT).filter((entry) => entry.endsWith('.png'));

    const broken = referenced.filter((name) => !onDisk.includes(name));
    const unused = onDisk.filter((name) => !referenced.includes(name));

    if (broken.length) console.warn(`  ⚠ liens cassés dans le manuel : ${broken.join(', ')}`);
    if (unused.length) console.warn(`  ⚠ captures non référencées : ${unused.join(', ')}`);
    if (!broken.length && !unused.length) console.log('  ✓ manuel et captures cohérents');
    console.log(
      "Restent à produire à la main : les écrans de consentement Google et GitHub, qui\n" +
        'appartiennent à ces fournisseurs et exigent un compte réel.',
    );
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error('\nÉchec de la capture :', err.message);
  console.error(`Vérifiez que la pile tourne (${CLIENT}) et que le seed a été chargé.`);
  process.exit(1);
});
