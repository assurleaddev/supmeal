// @ts-check
const { PrismaClient, TagType, CookbookRole, MealType } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

// ─── Tags ────────────────────────────────────────────────────────────────────

const TAGS = [
  { name: 'entrée',           type: TagType.CATEGORY   },
  { name: 'plat principal',   type: TagType.CATEGORY   },
  { name: 'dessert',          type: TagType.CATEGORY   },
  { name: 'apéritif',         type: TagType.CATEGORY   },
  { name: 'soupe',            type: TagType.CATEGORY   },
  { name: 'salade',           type: TagType.CATEGORY   },
  { name: 'végétarien',       type: TagType.DIET       },
  { name: 'vegan',            type: TagType.DIET       },
  { name: 'sans gluten',      type: TagType.DIET       },
  { name: 'sans lactose',     type: TagType.DIET       },
  { name: 'halal',            type: TagType.DIET       },
  { name: 'facile',           type: TagType.DIFFICULTY },
  { name: 'intermédiaire',    type: TagType.DIFFICULTY },
  { name: 'difficile',        type: TagType.DIFFICULTY },
  { name: 'française',        type: TagType.CUISINE    },
  { name: 'italienne',        type: TagType.CUISINE    },
  { name: 'japonaise',        type: TagType.CUISINE    },
  { name: 'mexicaine',        type: TagType.CUISINE    },
  { name: 'indienne',         type: TagType.CUISINE    },
  { name: 'méditerranéenne',  type: TagType.CUISINE    },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function dateOffset(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(0, 0, 0, 0);
  return d;
}

function thisMonday() {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

async function ing(name) {
  return prisma.ingredient.upsert({ where: { name }, update: {}, create: { name } });
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🌱 Seeding database…');

  // ── 1. Tags ────────────────────────────────────────────────────────────────
  const tagMap = {};
  for (const tag of TAGS) {
    const t = await prisma.tag.upsert({
      where: { name: tag.name },
      update: {},
      create: tag,
    });
    tagMap[tag.name] = t.id;
  }
  console.log(`  ✓ ${TAGS.length} tags`);

  // ── 2. Users ───────────────────────────────────────────────────────────────
  const hash = (pw) => bcrypt.hash(pw, 12);

  const alice = await prisma.user.upsert({
    where: { email: 'alice@test.com' },
    update: {},
    create: {
      email: 'alice@test.com',
      username: 'alice',
      passwordHash: await hash('password123'),
      preferences: {
        create: {
          diet: ['végétarien'],
          allergies: [],
          cuisineTypes: ['française', 'italienne'],
          defaultPortions: 4,
        },
      },
    },
  });

  const bob = await prisma.user.upsert({
    where: { email: 'bob@test.com' },
    update: {},
    create: {
      email: 'bob@test.com',
      username: 'bob',
      passwordHash: await hash('password123'),
      preferences: {
        create: { diet: [], allergies: ['noix'], cuisineTypes: ['française'], defaultPortions: 2 },
      },
    },
  });

  const charlie = await prisma.user.upsert({
    where: { email: 'charlie@test.com' },
    update: {},
    create: {
      email: 'charlie@test.com',
      username: 'charlie',
      passwordHash: await hash('password123'),
    },
  });

  console.log('  ✓ 3 users  (alice / bob / charlie — password: password123)');

  // ── 3. Cookbook ────────────────────────────────────────────────────────────
  const cookbook = await prisma.cookbook.upsert({
    where: { id: 'seed-cookbook-famille' },
    update: {},
    create: {
      id: 'seed-cookbook-famille',
      name: 'Recettes de famille',
      description: 'Notre collection de recettes transmises de génération en génération.',
      createdById: alice.id,
      members: {
        createMany: {
          skipDuplicates: true,
          data: [
            { userId: alice.id,    role: CookbookRole.CREATOR   },
            { userId: bob.id,      role: CookbookRole.EDITOR     },
            { userId: charlie.id,  role: CookbookRole.COMMENTER  },
          ],
        },
      },
    },
  });
  console.log('  ✓ cookbook "Recettes de famille"  (alice=CREATOR, bob=EDITOR, charlie=COMMENTER)');

  // ── 4. Recipes ─────────────────────────────────────────────────────────────

  const recipes = [
    {
      id: 'seed-recipe-carbonara',
      title: 'Pasta Carbonara',
      description: 'La vraie carbonara romaine — sans crème fraîche. Onctuosité garantie par la liaison œuf-pecorino.',
      prepTime: 10, cookTime: 20, portions: 4,
      sourceUrl: 'https://www.marmiton.org',
      isPersonal: false, cookbookId: cookbook.id, createdById: alice.id,
      tags: ['plat principal', 'italienne', 'facile'],
      ingredients: [
        { name: 'spaghetti',           quantity: 400,  unit: 'g' },
        { name: "guanciale",           quantity: 150,  unit: 'g',      notes: 'ou lardons fumés' },
        { name: "jaunes d'œuf",        quantity: 4,    unit: 'pièces' },
        { name: 'pecorino romano',     quantity: 80,   unit: 'g',      notes: 'râpé finement' },
        { name: 'parmesan',            quantity: 40,   unit: 'g',      notes: 'râpé' },
        { name: 'poivre noir',         unit: 'au goût' },
        { name: 'sel',                 unit: 'au goût' },
      ],
      steps: [
        { description: "Faire bouillir une grande casserole d'eau salée.", duration: 10 },
        { description: "Couper le guanciale en lardons et faire dorer à feu vif dans une poêle sans matière grasse. Réserver." },
        { description: "Mélanger les jaunes d'œuf, le pecorino, le parmesan et du poivre dans un bol.", duration: 5 },
        { description: "Cuire les spaghetti al dente. Réserver 1 louche d'eau de cuisson.", duration: 10 },
        { description: "Hors du feu, mélanger les pâtes avec le guanciale, puis verser la sauce œuf-fromage en ajoutant l'eau de cuisson petit à petit pour créer une émulsion crémeuse.", duration: 3 },
        { description: "Poivrer généreusement et servir immédiatement." },
      ],
    },
    {
      id: 'seed-recipe-quiche',
      title: 'Quiche Lorraine',
      description: "Un classique français inratable. Croustillante à l'extérieur, fondante à l'intérieur.",
      prepTime: 20, cookTime: 40, portions: 6,
      isPersonal: false, cookbookId: cookbook.id, createdById: bob.id,
      tags: ['plat principal', 'française', 'intermédiaire'],
      ingredients: [
        { name: 'pâte brisée',        quantity: 1,    unit: 'rouleau' },
        { name: 'lardons fumés',      quantity: 200,  unit: 'g' },
        { name: 'crème fraîche',      quantity: 20,   unit: 'cl' },
        { name: 'lait entier',        quantity: 10,   unit: 'cl' },
        { name: 'œufs',               quantity: 3,    unit: 'pièces' },
        { name: 'gruyère râpé',       quantity: 80,   unit: 'g' },
        { name: 'muscade',            unit: 'pincée' },
        { name: 'sel',                unit: 'au goût' },
        { name: 'poivre noir',        unit: 'au goût' },
      ],
      steps: [
        { description: "Préchauffer le four à 180°C. Étaler la pâte brisée dans un moule à tarte et piquer le fond." },
        { description: "Faire revenir les lardons à sec dans une poêle jusqu'à ce qu'ils soient dorés. Égoutter." },
        { description: "Fouetter les œufs avec la crème et le lait. Assaisonner de sel, poivre et muscade.", duration: 3 },
        { description: "Répartir les lardons et le gruyère sur le fond de tarte." },
        { description: "Verser l'appareil à quiche sur les lardons.", duration: 2 },
        { description: "Cuire 35–40 min jusqu'à ce que la quiche soit dorée et ferme au centre.", duration: 40 },
        { description: "Laisser tiédir 5 minutes avant de servir." },
      ],
    },
    {
      id: 'seed-recipe-ratatouille',
      title: 'Ratatouille provençale',
      description: 'Mijotée lentement pour concentrer les saveurs estivales. Meilleure le lendemain.',
      prepTime: 25, cookTime: 60, portions: 6,
      isPersonal: false, cookbookId: cookbook.id, createdById: alice.id,
      tags: ['plat principal', 'française', 'végétarien', 'vegan', 'méditerranéenne', 'facile'],
      ingredients: [
        { name: 'aubergine',          quantity: 2,   unit: 'pièces' },
        { name: 'courgette',          quantity: 2,   unit: 'pièces' },
        { name: 'poivron rouge',      quantity: 1,   unit: 'pièce' },
        { name: 'poivron jaune',      quantity: 1,   unit: 'pièce' },
        { name: 'tomates mûres',      quantity: 4,   unit: 'pièces' },
        { name: 'oignon',             quantity: 2,   unit: 'pièces' },
        { name: 'ail',                quantity: 4,   unit: 'gousses' },
        { name: "huile d'olive",      quantity: 6,   unit: 'cs' },
        { name: 'thym',               quantity: 3,   unit: 'brins' },
        { name: 'basilic frais',      quantity: 1,   unit: 'bouquet' },
        { name: 'sel',                unit: 'au goût' },
        { name: 'poivre noir',        unit: 'au goût' },
      ],
      steps: [
        { description: "Couper tous les légumes en dés de 2 cm réguliers. Saler les aubergines et courgettes, laisser dégorger 15 min, puis éponger.", duration: 20 },
        { description: "Dans une grande cocotte, faire revenir les oignons dans l'huile d'olive à feu moyen jusqu'à translucidité.", duration: 8 },
        { description: "Ajouter l'ail et les poivrons. Cuire 5 minutes supplémentaires.", duration: 5 },
        { description: "Incorporer les aubergines et courgettes. Faire revenir à feu vif 5 minutes.", duration: 5 },
        { description: "Ajouter les tomates, le thym, sel et poivre. Couvrir et laisser mijoter 45 minutes à feu doux.", duration: 45 },
        { description: "Rectifier l'assaisonnement, parsemer de basilic frais ciselé et servir." },
      ],
    },
    {
      id: 'seed-recipe-creme-brulee',
      title: 'Crème Brûlée',
      description: 'La surface caramélisée craque sous la cuillère pour révéler une crème onctueuse à la vanille.',
      prepTime: 15, cookTime: 50, portions: 4,
      isPersonal: false, cookbookId: cookbook.id, createdById: alice.id,
      tags: ['dessert', 'française', 'intermédiaire', 'sans gluten'],
      ingredients: [
        { name: 'crème liquide entière', quantity: 500, unit: 'ml' },
        { name: "jaunes d'œuf",          quantity: 6,   unit: 'pièces' },
        { name: 'sucre semoule',          quantity: 100, unit: 'g' },
        { name: 'gousse de vanille',      quantity: 1,   unit: 'pièce' },
        { name: 'cassonade',              quantity: 4,   unit: 'cs',   notes: 'pour caraméliser' },
      ],
      steps: [
        { description: "Préchauffer le four à 150°C. Fendre la gousse de vanille et gratter les graines dans la crème. Porter la crème à frémissement, puis retirer du feu." },
        { description: "Fouetter les jaunes avec le sucre jusqu'à blanchiment.", duration: 5 },
        { description: "Verser la crème chaude progressivement sur les jaunes en fouettant constamment.", duration: 3 },
        { description: "Filtrer et répartir dans 4 ramequins placés dans un bain-marie d'eau chaude.", duration: 5 },
        { description: "Cuire 40–45 min : les crèmes doivent être tremblotantes au centre.", duration: 45 },
        { description: "Réfrigérer au moins 2 heures.", duration: 120 },
        { description: "Au moment de servir, saupoudrer de cassonade et brûler au chalumeau jusqu'à caramélisation dorée." },
      ],
    },
    {
      id: 'seed-recipe-soupe-oignon',
      title: "Soupe à l'oignon gratinée",
      description: "Réconfortante et profondément parfumée. Le secret : caraméliser lentement les oignons.",
      prepTime: 15, cookTime: 60, portions: 4,
      isPersonal: true, createdById: alice.id,
      tags: ['soupe', 'française', 'végétarien', 'facile'],
      ingredients: [
        { name: 'oignons jaunes',         quantity: 1,   unit: 'kg' },
        { name: 'beurre',                 quantity: 50,  unit: 'g' },
        { name: "huile d'olive",          quantity: 2,   unit: 'cs' },
        { name: 'vin blanc sec',          quantity: 15,  unit: 'cl' },
        { name: 'bouillon de bœuf',       quantity: 1.5, unit: 'L' },
        { name: 'thym',                   quantity: 2,   unit: 'brins' },
        { name: 'farine',                 quantity: 1,   unit: 'cs' },
        { name: 'pain de campagne',       quantity: 4,   unit: 'tranches', notes: 'épaisses, grillées' },
        { name: 'gruyère râpé',           quantity: 150, unit: 'g' },
        { name: 'sel',                    unit: 'au goût' },
        { name: 'poivre noir',            unit: 'au goût' },
      ],
      steps: [
        { description: "Émincer finement les oignons. Dans une grande casserole, faire fondre le beurre avec l'huile à feu doux." },
        { description: "Ajouter les oignons, couvrir et cuire 20 min à feu doux en remuant régulièrement.", duration: 20 },
        { description: "Retirer le couvercle, monter à feu moyen et laisser caraméliser 20 minutes supplémentaires jusqu'à coloration dorée foncée.", duration: 20 },
        { description: "Ajouter la farine, mélanger 1 minute, puis déglacer avec le vin blanc.", duration: 3 },
        { description: "Verser le bouillon, ajouter le thym. Laisser mijoter 20 minutes à feu doux.", duration: 20 },
        { description: "Préchauffer le gril du four. Verser la soupe dans des bols allant au four, poser une tranche de pain grillé et couvrir généreusement de gruyère." },
        { description: "Gratiner sous le gril 3–5 minutes jusqu'à ce que le fromage soit doré et bouillonnant.", duration: 5 },
      ],
    },
    {
      id: 'seed-recipe-tarte-tatin',
      title: 'Tarte Tatin aux pommes',
      description: 'La tarte renversée la plus célèbre du monde. Des pommes fondantes, un caramel beurre salé, une pâte dorée.',
      prepTime: 20, cookTime: 45, portions: 8,
      isPersonal: true, createdById: bob.id,
      tags: ['dessert', 'française', 'intermédiaire'],
      ingredients: [
        { name: 'pommes golden',      quantity: 1.2, unit: 'kg',   notes: 'environ 6 pommes' },
        { name: 'sucre semoule',      quantity: 150, unit: 'g' },
        { name: 'beurre demi-sel',    quantity: 80,  unit: 'g' },
        { name: 'pâte feuilletée',    quantity: 1,   unit: 'rouleau' },
        { name: 'cannelle',           quantity: 1,   unit: 'cc',   notes: 'optionnel' },
      ],
      steps: [
        { description: "Éplucher, épépiner et couper les pommes en quartiers épais." },
        { description: "Dans une poêle allant au four, faire fondre le beurre à feu moyen. Ajouter le sucre et laisser caraméliser sans remuer jusqu'à obtenir un caramel blond ambré.", duration: 8 },
        { description: "Disposer les quartiers de pommes bien serrés en rosace dans le caramel. Cuire 10 minutes à feu moyen.", duration: 10 },
        { description: "Préchauffer le four à 200°C." },
        { description: "Couvrir les pommes avec la pâte feuilletée, en rentrant les bords sous les pommes. Piquer avec une fourchette." },
        { description: "Enfourner 25–30 minutes jusqu'à ce que la pâte soit bien dorée.", duration: 30 },
        { description: "Sortir du four, laisser reposer 5 minutes, puis retourner sur un plat de service. Servir tiède avec de la crème fraîche." },
      ],
    },
    {
      id: 'seed-recipe-nicoise',
      title: 'Salade Niçoise',
      description: "La vraie salade niçoise n'a pas de haricots verts cuits ni de pommes de terre. Tout est cru et frais.",
      prepTime: 20, cookTime: 10, portions: 4,
      isPersonal: true, createdById: charlie.id,
      tags: ['salade', 'entrée', 'française', 'méditerranéenne', 'facile', 'sans gluten'],
      ingredients: [
        { name: 'thon en boîte',           quantity: 200,  unit: 'g',    notes: "à l'huile d'olive" },
        { name: 'anchois',                 quantity: 8,    unit: 'filets' },
        { name: 'tomates cerises',         quantity: 300,  unit: 'g' },
        { name: 'poivron rouge',           quantity: 0.5,  unit: 'pièce' },
        { name: 'concombre',               quantity: 1,    unit: 'pièce', notes: 'pelé, tranché' },
        { name: 'olives noires niçoises',  quantity: 80,   unit: 'g' },
        { name: 'œufs durs',              quantity: 4,    unit: 'pièces' },
        { name: 'fèves fraîches',          quantity: 100,  unit: 'g',    notes: 'ou radis tranchés' },
        { name: "huile d'olive",           quantity: 4,    unit: 'cs' },
        { name: 'vinaigre de xérès',       quantity: 1,    unit: 'cs' },
        { name: 'ail',                     quantity: 1,    unit: 'gousse', notes: 'frotté dans le saladier' },
        { name: 'sel',                     unit: 'au goût' },
        { name: 'poivre noir',             unit: 'au goût' },
      ],
      steps: [
        { description: "Cuire les œufs 9 minutes dans l'eau bouillante. Refroidir, écaler et couper en quartiers.", duration: 12 },
        { description: "Frotter l'intérieur du saladier avec la gousse d'ail coupée." },
        { description: "Préparer la vinaigrette : mélanger l'huile d'olive, le vinaigre, sel et poivre." },
        { description: "Couper les tomates cerises en deux, trancher le concombre et le poivron." },
        { description: "Dresser tous les ingrédients dans le saladier de façon harmonieuse sans mélanger. Répartir le thon émietté, les anchois, les olives et les œufs." },
        { description: "Arroser de vinaigrette au moment de servir. Ne jamais mélanger — c'est une salade composée." },
      ],
    },
  ];

  for (const r of recipes) {
    // Prepare ingredients
    const ingredientData = [];
    for (let i = 0; i < r.ingredients.length; i++) {
      const { name, quantity, unit, notes } = r.ingredients[i];
      const ingredient = await ing(name);
      ingredientData.push({ ingredientId: ingredient.id, quantity, unit, notes, orderIndex: i });
    }

    // Clean up dependents to allow re-seeding
    await prisma.recipeIngredient.deleteMany({ where: { recipe: { id: r.id } } });
    await prisma.recipeStep.deleteMany({ where: { recipe: { id: r.id } } });
    await prisma.recipeTag.deleteMany({ where: { recipe: { id: r.id } } });

    await prisma.recipe.upsert({
      where: { id: r.id },
      update: {},
      create: {
        id: r.id,
        title: r.title,
        description: r.description,
        prepTime: r.prepTime,
        cookTime: r.cookTime,
        portions: r.portions,
        sourceUrl: r.sourceUrl || null,
        isPersonal: r.isPersonal,
        cookbookId: r.cookbookId || null,
        createdById: r.createdById,
        ingredients: { create: ingredientData },
        steps: {
          create: r.steps.map((s, i) => ({
            orderIndex: i,
            description: s.description,
            duration: s.duration || null,
          })),
        },
        tags: {
          create: r.tags
            .filter((name) => tagMap[name])
            .map((name) => ({ tagId: tagMap[name] })),
        },
      },
    });
  }
  console.log(`  ✓ ${recipes.length} recipes with ingredients and steps`);

  // ── 5. Favorites ───────────────────────────────────────────────────────────
  const favData = [
    { userId: alice.id,   recipeId: 'seed-recipe-carbonara'   },
    { userId: alice.id,   recipeId: 'seed-recipe-creme-brulee' },
    { userId: bob.id,     recipeId: 'seed-recipe-quiche'       },
    { userId: bob.id,     recipeId: 'seed-recipe-tarte-tatin'  },
    { userId: charlie.id, recipeId: 'seed-recipe-nicoise'      },
    { userId: charlie.id, recipeId: 'seed-recipe-carbonara'    },
  ];
  for (const fav of favData) {
    await prisma.favorite.upsert({
      where: { userId_recipeId: fav },
      update: {},
      create: fav,
    });
  }
  console.log('  ✓ 6 favorites');

  // ── 6. Meal Plan ───────────────────────────────────────────────────────────
  await prisma.mealPlanItem.deleteMany({ where: { mealPlan: { id: 'seed-mealplan-alice' } } });
  await prisma.mealPlan.upsert({
    where: { id: 'seed-mealplan-alice' },
    update: {},
    create: {
      id: 'seed-mealplan-alice',
      userId: alice.id,
      name: 'Semaine test',
      weekStart: thisMonday(),
      items: {
        create: [
          { recipeId: 'seed-recipe-soupe-oignon', date: dateOffset(0), mealType: MealType.DINNER,    portions: 4 },
          { recipeId: 'seed-recipe-carbonara',    date: dateOffset(1), mealType: MealType.LUNCH,     portions: 2 },
          { recipeId: 'seed-recipe-ratatouille',  date: dateOffset(2), mealType: MealType.DINNER,    portions: 6 },
          { recipeId: 'seed-recipe-nicoise',      date: dateOffset(3), mealType: MealType.LUNCH,     portions: 4 },
          { recipeId: 'seed-recipe-quiche',       date: dateOffset(4), mealType: MealType.DINNER,    portions: 6 },
          { recipeId: 'seed-recipe-creme-brulee', date: dateOffset(4), mealType: MealType.DINNER,    portions: 4 },
        ],
      },
    },
  });
  console.log('  ✓ meal plan (6 items, this week)');

  // ── 7. Comments ────────────────────────────────────────────────────────────
  const existingComments = await prisma.comment.count({
    where: { recipeId: { in: ['seed-recipe-carbonara', 'seed-recipe-quiche', 'seed-recipe-ratatouille'] } },
  });
  if (existingComments === 0) {
    await prisma.comment.createMany({
      data: [
        { recipeId: 'seed-recipe-carbonara',   userId: bob.id,     content: 'Enfin une vraie carbonara sans crème ! Résultat parfait du premier coup.' },
        { recipeId: 'seed-recipe-carbonara',   userId: charlie.id, content: 'Le guanciale fait vraiment la différence. Difficile à trouver mais ça vaut le détour.' },
        { recipeId: 'seed-recipe-quiche',      userId: alice.id,   content: "J'ai ajouté un peu de fromage de chèvre — excellent !" },
        { recipeId: 'seed-recipe-ratatouille', userId: charlie.id, content: 'Meilleure le lendemain comme annoncé 👌 Je la fais toujours la veille maintenant.' },
        { recipeId: 'seed-recipe-ratatouille', userId: bob.id,     content: "Astuce : ajouter une cuillère de concentré de tomate pour intensifier la saveur." },
      ],
    });
  }
  console.log('  ✓ 5 comments');

  // ── 8. Messages ────────────────────────────────────────────────────────────
  const existingMessages = await prisma.message.count({ where: { cookbookId: cookbook.id } });
  if (existingMessages === 0) {
    const now = Date.now();
    await prisma.message.createMany({
      data: [
        { cookbookId: cookbook.id, userId: alice.id,   content: "Bienvenue dans notre cookbook ! J'ai ajouté quelques recettes de base 🍝", createdAt: new Date(now - 3600_000 * 3) },
        { cookbookId: cookbook.id, userId: bob.id,     content: "Super ! J'ai ajouté la quiche lorraine de ma grand-mère.", createdAt: new Date(now - 3600_000 * 2) },
        { cookbookId: cookbook.id, userId: charlie.id, content: "La ratatouille a l'air top. Je teste ça ce week-end !", createdAt: new Date(now - 3600_000) },
        { cookbookId: cookbook.id, userId: alice.id,   content: "N'oubliez pas de laisser vos commentaires sur les recettes 😄", createdAt: new Date(now - 600_000) },
      ],
    });
  }
  console.log('  ✓ 4 chat messages in cookbook');

  console.log('\n✅ Seed complete!\n');
  console.log('  Test accounts:');
  console.log('    alice@test.com   / password123  (creator, 4 recipes, preferences)');
  console.log('    bob@test.com     / password123  (editor in cookbook, 2 recipes)');
  console.log('    charlie@test.com / password123  (commenter in cookbook, 1 recipe)');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
