/**
 * Test de bout en bout de l'API contre une pile réellement démarrée.
 *
 * Volontairement séparé des tests unitaires (`npm test`) : il exige une base de données et un
 * serveur en fonctionnement, et crée puis supprime des comptes réels.
 *
 *   docker compose up -d
 *   npm run test:e2e
 *
 * Toutes les requêtes passent par `http` avec des corps encodés en UTF-8 explicitement : passer par
 * un shell Windows corrompt les caractères accentués et produit de faux échecs.
 */
import http from 'node:http';
import assert from 'node:assert/strict';

const HOST = process.env.E2E_HOST || 'localhost';
const PORT = Number(process.env.E2E_PORT || 3000);

interface Reply {
  status: number;
  body: any;
}

function request(
  method: string,
  path: string,
  options: { body?: unknown; token?: string } = {},
): Promise<Reply> {
  return new Promise((resolve, reject) => {
    const payload = options.body ? Buffer.from(JSON.stringify(options.body), 'utf8') : null;

    const req = http.request(
      {
        host: HOST,
        port: PORT,
        path,
        method,
        headers: {
          ...(payload
            ? { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': payload.length }
            : {}),
          ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
        },
      },
      (res) => {
        let raw = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => (raw += chunk));
        res.on('end', () => {
          let body: any = null;
          try {
            body = raw ? JSON.parse(raw) : null;
          } catch {
            body = { raw };
          }
          resolve({ status: res.statusCode ?? 0, body });
        });
      },
    );

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

let failures = 0;
let checks = 0;

function expect(label: string, condition: boolean, detail = '') {
  checks++;
  if (condition) {
    console.log(`  OK   ${label}`);
  } else {
    failures++;
    console.log(`  FAIL ${label}${detail ? `\n         ${detail}` : ''}`);
  }
}

const section = (title: string) => console.log(`\n── ${title} ──`);

const stamp = Date.now();
const password = 'password123';

async function register(prefix: string) {
  const email = `${prefix}${stamp}@e2e.local`;
  const reply = await request('POST', '/api/auth/register', {
    body: { email, username: `${prefix}${stamp}`, password },
  });
  assert.equal(reply.status, 201, `inscription ${prefix} : ${JSON.stringify(reply.body)}`);
  return { email, token: reply.body.data.accessToken as string, id: reply.body.data.user.id as string };
}

async function main() {
  const health = await request('GET', '/api/health');
  assert.equal(health.status, 200, 'le serveur doit être joignable sur ' + `${HOST}:${PORT}`);

  const alice = await register('alice');
  const bob = await register('bob');

  // ───────────────────────────────────────
  section('Recette : champs optionnels vides');

  const created = await request('POST', '/api/recipes', {
    token: alice.token,
    body: {
      title: 'Crème brûlée',
      description: '',
      sourceUrl: '',
      portions: 4,
      ingredients: [{ name: 'Crème fraîche', quantity: null, unit: '', notes: '', orderIndex: 0 }],
      steps: [{ description: 'Préchauffer à 150°C', orderIndex: 0 }],
      tags: ['dessert'],
    },
  });
  expect('création acceptée malgré les champs vides', created.status === 201, `HTTP ${created.status}`);
  const recipeId = created.body?.data?.id as string;

  const detail = await request('GET', `/api/recipes/${recipeId}`, { token: alice.token });
  expect('accents préservés dans le titre', detail.body?.data?.title === 'Crème brûlée');
  expect('accents préservés dans une étape', detail.body?.data?.steps?.[0]?.description === 'Préchauffer à 150°C');
  expect('ingrédient canonicalisé', detail.body?.data?.ingredients?.[0]?.ingredient?.name === 'crème fraîche');
  expect('champs vides ramenés à null', detail.body?.data?.sourceUrl === null);
  expect('droits d écriture renvoyés', detail.body?.data?.permissions?.canEdit === true);

  const badUrl = await request('POST', '/api/recipes', {
    token: alice.token,
    body: { title: 'X', sourceUrl: 'pas-une-url', ingredients: [{ name: 'a' }], steps: [{ description: 'b', orderIndex: 0 }] },
  });
  expect('URL malformée refusée en 400', badUrl.status === 400, `HTTP ${badUrl.status}`);

  // ───────────────────────────────────────
  section('Recherche : accents, casse, jokers');

  const search = async (term: string) => {
    const reply = await request('GET', `/api/recipes?q=${encodeURIComponent(term)}`, { token: alice.token });
    return reply.body?.data?.total;
  };

  for (const term of ['creme', 'brulee', 'prechauffer', 'CRÈME', 'crème fraiche']) {
    expect(`« ${term} » trouve la recette`, (await search(term)) === 1);
  }
  expect('terme absent ne trouve rien', (await search('chocolat')) === 0);
  expect('joker « % » neutralisé', (await search('%')) === 0);

  // ───────────────────────────────────────
  section('Cloisonnement entre comptes');

  expect("Bob ne voit pas la recette privée d'Alice", (await request('GET', `/api/recipes?q=${encodeURIComponent('creme')}`, { token: bob.token })).body?.data?.total === 0);
  expect('lecture directe refusée', (await request('GET', `/api/recipes/${recipeId}`, { token: bob.token })).status === 403);
  expect('commentaires refusés', (await request('GET', `/api/recipes/${recipeId}/comments`, { token: bob.token })).status === 403);
  expect('modification refusée', (await request('PUT', `/api/recipes/${recipeId}`, { token: bob.token, body: { title: 'pirate' } })).status === 403);
  expect('suppression refusée', (await request('DELETE', `/api/recipes/${recipeId}`, { token: bob.token })).status === 403);

  // ───────────────────────────────────────
  section('Cookbook partagé et rôles');

  const cookbook = await request('POST', '/api/cookbooks', { token: alice.token, body: { name: `Partage ${stamp}` } });
  const cookbookId = cookbook.body?.data?.id as string;
  expect('création du cookbook', cookbook.status === 201);
  expect('créateur : tous les droits', cookbook.body?.data?.permissions?.canManageMembers === true);

  const invite = await request('POST', `/api/cookbooks/${cookbookId}/invite`, {
    token: alice.token,
    body: { email: bob.email, role: 'EDITOR' },
  });
  expect('invitation émise', invite.status === 201);

  const strangerInvite = await request('POST', `/api/cookbooks/${cookbookId}/invite`, {
    token: bob.token,
    body: { email: 'x@y.io' },
  });
  expect('un non-membre ne peut pas inviter', strangerInvite.status === 403);

  const joined = await request('POST', `/api/cookbooks/join/${invite.body.data.token}`, { token: bob.token });
  expect('adhésion en EDITOR', joined.body?.data?.role === 'EDITOR');

  const otherInvite = await request('POST', `/api/cookbooks/${cookbookId}/invite`, {
    token: alice.token,
    body: { email: 'personne@ailleurs.io', role: 'READER' },
  });
  const stolen = await request('POST', `/api/cookbooks/join/${otherInvite.body.data.token}`, { token: bob.token });
  expect("invitation nominative : un autre compte ne peut pas l'utiliser", stolen.status === 403);

  const shared = await request('POST', '/api/recipes', {
    token: bob.token,
    body: {
      title: 'Poulet basquaise',
      cookbookId,
      ingredients: [{ name: 'poulet', quantity: 1, unit: 'kg', orderIndex: 0 }],
      steps: [{ description: 'Faire revenir', orderIndex: 0 }],
      tags: ['plat principal'],
    },
  });
  const sharedId = shared.body?.data?.id as string;
  expect('un EDITOR contribue une recette', shared.status === 201);

  for (const [term, label] of [['basquaise', 'titre'], ['poulet', 'ingrédient'], ['revenir', 'contenu des étapes'], ['plat principal', 'tag']]) {
    const reply = await request('GET', `/api/recipes?cookbookId=${cookbookId}&q=${encodeURIComponent(term)}`, { token: alice.token });
    expect(`recherche du cookbook par ${label}`, reply.body?.data?.total === 1);
  }

  const aliceEdits = await request('PUT', `/api/recipes/${sharedId}`, { token: alice.token, body: { title: 'Poulet basquaise revisité' } });
  expect("le créateur modifie la recette d'un membre", aliceEdits.status === 200);

  await request('PATCH', `/api/cookbooks/${cookbookId}/members/${bob.id}`, { token: alice.token, body: { role: 'READER' } });
  const asReader = await request('GET', `/api/cookbooks/${cookbookId}`, { token: bob.token });
  expect('rétrogradation en READER', asReader.body?.data?.myRole === 'READER');
  expect('un READER ne peut pas commenter', asReader.body?.data?.permissions?.canComment === false);

  const readerComment = await request('POST', `/api/recipes/${sharedId}/comments`, { token: bob.token, body: { content: 'test' } });
  expect('commentaire refusé au READER', readerComment.status === 403);

  await request('DELETE', `/api/cookbooks/${cookbookId}/leave`, { token: bob.token });
  expect('après son départ, plus aucun accès', (await request('GET', `/api/recipes/${sharedId}`, { token: bob.token })).status === 403);
  expect('la recette reste intacte pour le créateur', (await request('GET', `/api/recipes/${sharedId}`, { token: alice.token })).status === 200);

  // ───────────────────────────────────────
  section('Favoris');

  expect('mise en favori', (await request('POST', `/api/recipes/${recipeId}/favorite`, { token: alice.token })).body?.data?.isFavorite === true);
  expect('filtre favoris', (await request('GET', '/api/recipes?favorites=true', { token: alice.token })).body?.data?.total === 1);
  expect('retrait du favori', (await request('DELETE', `/api/recipes/${recipeId}/favorite`, { token: alice.token })).body?.data?.isFavorite === false);
  expect('filtre favoris vidé', (await request('GET', '/api/recipes?favorites=true', { token: alice.token })).body?.data?.total === 0);

  // ───────────────────────────────────────
  section('Planification : le dimanche');

  // 2026-09-06 est un dimanche ; sa semaine commence le lundi 2026-08-31.
  for (const [date, label] of [['2026-09-06', 'dimanche'], ['2026-08-31', 'lundi'], ['2026-09-02', 'mercredi']]) {
    const reply = await request('POST', '/api/meal-plans/schedule', {
      token: alice.token,
      body: { recipeId, date, mealType: 'DINNER' },
    });
    expect(`${date} (${label}) rattaché à la semaine du 2026-08-31`, reply.body?.data?.weekStart === '2026-08-31', `obtenu ${reply.body?.data?.weekStart}`);
  }

  const plannedRecipe = await request('POST', '/api/recipes', {
    token: alice.token,
    body: { title: 'À planifier', ingredients: [{ name: 'sel' }], steps: [{ description: 'x', orderIndex: 0 }] },
  });
  const plannedId = plannedRecipe.body.data.id as string;
  await request('POST', '/api/meal-plans/schedule', { token: alice.token, body: { recipeId: plannedId, date: '2026-09-06', mealType: 'LUNCH' } });
  expect('une recette planifiée reste supprimable', (await request('DELETE', `/api/recipes/${plannedId}`, { token: alice.token })).status === 200);

  // ───────────────────────────────────────
  section('Planification partagée (§2.1)');

  // Un cookbook neuf, avec Bob remis EDITOR : les rétrogradations précédentes l'ont laissé READER.
  const planCookbook = await request('POST', '/api/cookbooks', {
    token: alice.token,
    body: { name: `Planning partagé ${stamp}` },
  });
  const planCookbookId = planCookbook.body?.data?.id as string;

  const planInvite = await request('POST', `/api/cookbooks/${planCookbookId}/invite`, {
    token: alice.token,
    body: { email: bob.email, role: 'EDITOR' },
  });
  await request('POST', `/api/cookbooks/join/${planInvite.body.data.token}`, { token: bob.token });

  const sharedPlan = await request('POST', '/api/meal-plans', {
    token: alice.token,
    body: { name: 'Menus du groupe', weekStart: '2026-10-05', cookbookId: planCookbookId },
  });
  expect('création d un planning rattaché à un cookbook', sharedPlan.status === 201, `HTTP ${sharedPlan.status}`);
  const sharedPlanId = sharedPlan.body?.data?.id as string;

  // Le cœur de l'exigence : un autre membre doit voir le planning du groupe.
  const bobPlans = await request('GET', '/api/meal-plans', { token: bob.token });
  expect(
    'un autre membre voit le planning du groupe',
    (bobPlans.body?.data ?? []).some((p: any) => p.id === sharedPlanId),
  );
  expect(
    'lecture directe autorisée au membre',
    (await request('GET', `/api/meal-plans/${sharedPlanId}`, { token: bob.token })).status === 200,
  );

  // La recette planifiée doit être visible de Bob : une recette personnelle d'Alice lui est
  // légitimement refusée, on en dépose donc une dans le cookbook du groupe.
  const groupRecipe = await request('POST', '/api/recipes', {
    token: alice.token,
    body: {
      title: 'Rôti du dimanche',
      cookbookId: planCookbookId,
      ingredients: [{ name: 'rôti', quantity: 1, unit: 'kg', orderIndex: 0 }],
      steps: [{ description: 'Enfourner', orderIndex: 0 }],
    },
  });
  const groupRecipeId = groupRecipe.body?.data?.id as string;

  expect(
    'une recette personnelle d autrui reste refusée',
    (await request('POST', `/api/meal-plans/${sharedPlanId}/items`, {
      token: bob.token,
      body: { recipeId, date: '2026-10-06', mealType: 'LUNCH' },
    })).status === 404,
  );

  const bobAdds = await request('POST', `/api/meal-plans/${sharedPlanId}/items`, {
    token: bob.token,
    body: { recipeId: groupRecipeId, date: '2026-10-07', mealType: 'DINNER' },
  });
  expect('un EDITOR ajoute un repas au planning du groupe', bobAdds.status === 201, `HTTP ${bobAdds.status}`);

  const aliceSees = await request('GET', `/api/meal-plans/${sharedPlanId}`, { token: alice.token });
  expect(
    'la contribution est visible par les autres',
    (aliceSees.body?.data?.items ?? []).some((i: any) => i.date.startsWith('2026-10-07')),
  );

  // Un tiers hors du cookbook ne doit rien voir.
  const stranger = await register('etranger');
  expect(
    'un non-membre ne voit pas le planning',
    (await request('GET', `/api/meal-plans/${sharedPlanId}`, { token: stranger.token })).status === 403,
  );
  expect(
    'un non-membre ne peut pas y planifier',
    (await request('POST', '/api/meal-plans', {
      token: stranger.token,
      body: { weekStart: '2026-10-05', cookbookId: planCookbookId },
    })).status === 403,
  );

  // Un READER consulte sans pouvoir remanier.
  await request('PATCH', `/api/cookbooks/${planCookbookId}/members/${bob.id}`, {
    token: alice.token,
    body: { role: 'READER' },
  });
  expect(
    'un READER lit toujours le planning',
    (await request('GET', `/api/meal-plans/${sharedPlanId}`, { token: bob.token })).status === 200,
  );
  expect(
    'un READER ne peut pas y ajouter de repas',
    (await request('POST', `/api/meal-plans/${sharedPlanId}/items`, {
      token: bob.token,
      body: { recipeId: groupRecipeId, date: '2026-10-08', mealType: 'LUNCH' },
    })).status === 403,
  );

  await request('DELETE', `/api/cookbooks/${planCookbookId}`, { token: alice.token });

  // ───────────────────────────────────────
  section('Export et import');

  const exportJson = await request('GET', '/api/export?format=json', { token: alice.token });
  expect('export JSON', exportJson.status === 200 && Array.isArray(exportJson.body?.personalRecipes));
  const exportMealie = await request('GET', '/api/export?format=mealie', { token: alice.token });
  expect('export Mealie', exportMealie.status === 200 && Array.isArray(exportMealie.body));
  expect('vocabulaire Mealie respecté', typeof exportMealie.body?.[0]?.name === 'string' && Array.isArray(exportMealie.body?.[0]?.recipeIngredient));
  expect('format inconnu refusé', (await request('GET', '/api/export?format=xml', { token: alice.token })).status === 400);

  // ───────────────────────────────────────
  section('OAuth2');

  const providers = await request('GET', '/api/auth/providers');
  expect('liste des fournisseurs exposée', providers.status === 200 && Array.isArray(providers.body?.data?.providers));
  console.log(`         configurés : ${providers.body.data.providers.join(', ') || 'aucun'}`);
  expect('fournisseur inconnu refusé', (await request('POST', '/api/auth/link/facebook', { token: alice.token })).status === 404);
  expect('liaison exige une session', (await request('POST', '/api/auth/link/google')).status === 401);

  // ───────────────────────────────────────
  section('Nettoyage');

  for (const token of [alice.token, bob.token]) {
    const list = await request('GET', '/api/recipes?limit=50', { token });
    for (const recipe of list.body?.data?.items ?? []) {
      await request('DELETE', `/api/recipes/${recipe.id}`, { token });
    }
  }
  await request('DELETE', `/api/cookbooks/${cookbookId}`, { token: alice.token });
  console.log('  OK   comptes de test vidés de leurs données');

  console.log(`\n${checks - failures}/${checks} vérifications passent.`);
  if (failures > 0) {
    console.error(`${failures} échec(s).`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('\nLe test a échoué avant son terme :', err.message);
  console.error("Vérifiez que la pile tourne (docker compose up -d) et que l'API répond sur " + `${HOST}:${PORT}.`);
  process.exit(1);
});
