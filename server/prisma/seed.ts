import { PrismaClient, TagType } from '@prisma/client';

const prisma = new PrismaClient();

const DEFAULT_TAGS = [
  // Categories
  { name: 'entrée', type: TagType.CATEGORY },
  { name: 'plat principal', type: TagType.CATEGORY },
  { name: 'dessert', type: TagType.CATEGORY },
  { name: 'apéritif', type: TagType.CATEGORY },
  { name: 'soupe', type: TagType.CATEGORY },
  { name: 'salade', type: TagType.CATEGORY },
  // Diets
  { name: 'végétarien', type: TagType.DIET },
  { name: 'vegan', type: TagType.DIET },
  { name: 'sans gluten', type: TagType.DIET },
  { name: 'sans lactose', type: TagType.DIET },
  { name: 'halal', type: TagType.DIET },
  // Difficulty
  { name: 'facile', type: TagType.DIFFICULTY },
  { name: 'intermédiaire', type: TagType.DIFFICULTY },
  { name: 'difficile', type: TagType.DIFFICULTY },
  // Cuisine
  { name: 'française', type: TagType.CUISINE },
  { name: 'italienne', type: TagType.CUISINE },
  { name: 'japonaise', type: TagType.CUISINE },
  { name: 'mexicaine', type: TagType.CUISINE },
  { name: 'indienne', type: TagType.CUISINE },
  { name: 'méditerranéenne', type: TagType.CUISINE },
];

async function main() {
  console.log('Seeding database...');

  for (const tag of DEFAULT_TAGS) {
    await prisma.tag.upsert({
      where: { name: tag.name },
      update: {},
      create: tag,
    });
  }

  console.log(`✅ Seeded ${DEFAULT_TAGS.length} tags`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
