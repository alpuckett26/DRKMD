import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST() {
  try {
    const store = await db.store.upsert({
      where: { id: 'store_demo' },
      update: {},
      create: {
        id: 'store_demo',
        name: 'Corner Stop 24',
        location: '123 Main St',
        windowModeEnabled: true,
        windowModeStart: '22:00',
        windowModeEnd: '06:00',
        timezone: 'America/Chicago',
      },
    })

    const products = [
      { name: 'Red Bull 8.4oz', category: 'Drinks', price: 349 },
      { name: 'Monster Energy 16oz', category: 'Drinks', price: 299 },
      { name: 'Gatorade 32oz', category: 'Drinks', price: 249 },
      { name: 'Bottled Water 20oz', category: 'Drinks', price: 149 },
      { name: 'Marlboro Reds (pack)', category: 'Tobacco', price: 1099, restrictedFlag: true },
      { name: 'Doritos Nacho 2.75oz', category: 'Snacks', price: 199 },
      { name: "Lay's Classic 2.625oz", category: 'Snacks', price: 199 },
      { name: 'Snickers Bar', category: 'Candy', price: 179 },
      { name: "Reese's Cups", category: 'Candy', price: 179 },
      { name: 'Tylenol PM 24ct', category: 'Health', price: 899 },
      { name: 'Advil 24ct', category: 'Health', price: 799 },
      { name: 'AA Batteries 4pk', category: 'General', price: 399 },
      { name: 'Phone Charger Cable', category: 'General', price: 999 },
    ]

    for (const p of products) {
      await db.product.create({
        data: {
          storeId: store.id,
          nighttimeAvailable: true,
          restrictedFlag: false,
          active: true,
          ...p,
        },
      })
    }

    return NextResponse.json({ ok: true, storeId: store.id })
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 })
  }
}
