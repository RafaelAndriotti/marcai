import { roundMoney, todayLocalDate, toLocalParts } from "@marcai/shared";
import { prisma } from "../src/config/prisma.js";
import { localDayRange } from "../src/utils/date.js";
import { Prisma, type BookingStatus, type ProductCategory, type Sport } from "../generated/prisma/client.js";

const today = todayLocalDate();
const tomorrow = toLocalParts(localDayRange(today).end).date;
const days = { today, tomorrow } as const;

/** Hora local de São Paulo -> Date (offset -03:00, sem horário de verão desde 2019). */
const at = (date: string, hhmm: string): Date => new Date(`${date}T${hhmm}:00-03:00`);

async function main(): Promise<void> {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Seed apaga todas as tabelas e não pode rodar com NODE_ENV=production.");
  }
  // idempotente: limpa e recria
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.product.deleteMany();
  await prisma.court.deleteMany();

  const courtDefs: { name: string; sport: Sport; pricePerHour: number }[] = [
    { name: "Quadra Areia 1", sport: "BEACH_TENNIS", pricePerHour: 100 },
    { name: "Quadra Areia 2", sport: "BEACH_TENNIS", pricePerHour: 120 },
    { name: "Quadra Vôlei", sport: "VOLEI", pricePerHour: 80 },
    { name: "Quadra Futevôlei", sport: "FUTEVOLEI", pricePerHour: 150 },
  ];
  const courts: Awaited<ReturnType<typeof prisma.court.create>>[] = [];
  for (const c of courtDefs) courts.push(await prisma.court.create({ data: c }));

  type Def = [court: number, day: keyof typeof days, from: string, to: string, status: BookingStatus, name: string, phone: string];
  const defs: Def[] = [
    [0, "today", "08:00", "09:30", "DONE", "Ana Souza", "11999990001"],
    [0, "today", "18:00", "19:30", "CONFIRMED", "Bruno Lima", "11999990002"],
    [0, "today", "20:00", "21:00", "PENDING", "Carla Dias", "11999990003"],
    [1, "today", "09:00", "10:00", "DONE", "Diego Alves", "11999990004"],
    [1, "today", "19:00", "21:00", "CONFIRMED", "Elisa Prado", "11999990005"],
    [2, "today", "07:00", "08:30", "CANCELLED", "Fábio Reis", "11999990006"],
    [2, "today", "19:30", "21:00", "PENDING", "Gabi Martins", "11999990007"],
    [3, "today", "17:00", "19:00", "CONFIRMED", "Hugo Neves", "11999990008"],
    [0, "tomorrow", "10:00", "11:30", "CONFIRMED", "Iara Costa", "11999990009"],
    [1, "tomorrow", "18:00", "19:00", "PENDING", "João Pires", "11999990010"],
    [2, "tomorrow", "20:00", "22:00", "CONFIRMED", "Karen Melo", "11999990011"],
    [3, "tomorrow", "16:00", "17:30", "PENDING", "Leo Faria", "11999990012"],
  ];

  const bookings: Awaited<ReturnType<typeof prisma.booking.create>>[] = [];
  for (const [ci, day, from, to, status, customerName, customerPhone] of defs) {
    const court = courts[ci]!;
    const startsAt = at(days[day], from);
    const endsAt = at(days[day], to);
    const hours = (endsAt.getTime() - startsAt.getTime()) / 3_600_000;
    bookings.push(
      await prisma.booking.create({
        data: {
          courtId: court.id,
          customerName,
          customerPhone,
          startsAt,
          endsAt,
          status,
          price: court.pricePerHour.mul(Math.round(hours * 60)).div(60).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP),
        },
      }),
    );
  }

  const productDefs: [string, number, ProductCategory][] = [
    ["Água 500ml", 5, "BEBIDA"],
    ["Refrigerante lata", 7, "BEBIDA"],
    ["Cerveja long neck", 12, "BEBIDA"],
    ["Isotônico", 9, "BEBIDA"],
    ["Açaí 300ml", 18, "COMIDA"],
    ["Energético", 12.5, "BEBIDA"],
    ["Sanduíche natural", 16, "COMIDA"],
    ["Porção de batata", 28, "COMIDA"],
  ];
  const products: Awaited<ReturnType<typeof prisma.product.create>>[] = [];
  for (const [name, price, category] of productDefs) {
    products.push(await prisma.product.create({ data: { name, price, category } }));
  }
  const p = (name: string) => products.find((x) => x.name === name)!;

  type Line = [name: string, qty: number];
  async function order(
    bookingId: string | null,
    customerName: string | null,
    status: "OPEN" | "PAID",
    lines: Line[],
  ): Promise<void> {
    const items = lines.map(([name, quantity]) => {
      const prod = p(name);
      const unitPrice = Number(prod.price);
      return {
        productId: prod.id,
        productName: prod.name,
        quantity,
        unitPrice,
        subtotal: roundMoney(unitPrice * quantity),
      };
    });
    await prisma.order.create({
      data: {
        bookingId,
        customerName,
        status,
        total: roundMoney(items.reduce((s, i) => s + i.subtotal, 0)),
        items: { create: items },
      },
    });
  }

  // 1 OPEN ligado a reserva de hoje (Bruno Lima), 1 PAID hoje, 1 OPEN avulso
  await order(bookings[1]!.id, "Bruno Lima", "OPEN", [["Água 500ml", 4], ["Cerveja long neck", 3]]);
  await order(bookings[0]!.id, "Ana Souza", "PAID", [["Açaí 300ml", 2], ["Isotônico", 2]]);
  await order(null, "Cliente balcão", "OPEN", [["Refrigerante lata", 2], ["Porção de batata", 1]]);

  console.log(
    `Seed ok: ${courts.length} quadras, ${bookings.length} reservas, ${products.length} produtos, 3 pedidos`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
