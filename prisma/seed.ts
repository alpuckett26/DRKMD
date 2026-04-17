import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const store = await prisma.store.upsert({
    where: { id: 'store_demo' },
    update: {},
    create: {
      id: 'store_demo',
      name: "Corner Stop 24",
      location: "123 Main St",
      windowModeEnabled: true,
      windowModeStart: "22:00",
      windowModeEnd: "06:00",
      timezone: "America/Chicago",
    },
  })

  const products = [
    { name: "Red Bull 8.4oz", category: "Drinks", price: 349, nighttimeAvailable: true, restrictedFlag: false },
    { name: "Monster Energy 16oz", category: "Drinks", price: 299, nighttimeAvailable: true, restrictedFlag: false },
    { name: "Gatorade 32oz", category: "Drinks", price: 249, nighttimeAvailable: true, restrictedFlag: false },
    { name: "Bottled Water 20oz", category: "Drinks", price: 149, nighttimeAvailable: true, restrictedFlag: false },
    { name: "Marlboro Reds (pack)", category: "Tobacco", price: 1099, nighttimeAvailable: true, restrictedFlag: true },
    { name: "Doritos Nacho (2.75oz)", category: "Snacks", price: 199, nighttimeAvailable: true, restrictedFlag: false },
    { name: "Lay's Classic (2.625oz)", category: "Snacks", price: 199, nighttimeAvailable: true, restrictedFlag: false },
    { name: "Snickers Bar", category: "Candy", price: 179, nighttimeAvailable: true, restrictedFlag: false },
    { name: "Reese's Cups", category: "Candy", price: 179, nighttimeAvailable: true, restrictedFlag: false },
    { name: "Hot Dog (roller grill)", category: "Food", price: 249, nighttimeAvailable: true, restrictedFlag: false },
    { name: "Cheeseburger (heated)", category: "Food", price: 349, nighttimeAvailable: true, restrictedFlag: false },
    { name: "Tylenol PM 24ct", category: "Health", price: 899, nighttimeAvailable: true, restrictedFlag: false },
    { name: "Advil 24ct", category: "Health", price: 799, nighttimeAvailable: true, restrictedFlag: false },
    { name: "Trojan Condoms 3pk", category: "Health", price: 699, nighttimeAvailable: true, restrictedFlag: false },
    { name: "Chapstick Original", category: "Health", price: 299, nighttimeAvailable: true, restrictedFlag: false },
    { name: "AA Batteries 4pk", category: "General", price: 399, nighttimeAvailable: true, restrictedFlag: false },
    { name: "Phone Charger Cable", category: "General", price: 999, nighttimeAvailable: true, restrictedFlag: false },
  ]

  for (const p of products) {
    await prisma.product.create({
      data: { ...p, storeId: store.id },
    })
  }

  console.log(`Seeded store: ${store.id} with ${products.length} products`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
