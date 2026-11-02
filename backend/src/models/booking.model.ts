import type { Booking, BookingStatus } from "@marcai/shared";
import { prisma, type Prisma } from "../config/prisma.js";

const withCourt = { court: { select: { id: true, name: true, sport: true } } } as const;
type DbBookingWithCourt = Prisma.BookingGetPayload<{ include: typeof withCourt }>;

/** Cliente de transação do Prisma. */
export type Tx = Prisma.TransactionClient;

function toBookingDto(b: DbBookingWithCourt): Booking {
  return {
    id: b.id,
    courtId: b.courtId,
    court: { id: b.court.id, name: b.court.name, sport: b.court.sport },
    customerName: b.customerName,
    customerPhone: b.customerPhone,
    startsAt: b.startsAt.toISOString(),
    endsAt: b.endsAt.toISOString(),
    status: b.status,
    price: b.price.toNumber(),
  };
}

export interface DayRange {
  start: Date;
  end: Date;
}

export const bookingModel = {
  async list(filter: { range?: DayRange; courtId?: string }): Promise<Booking[]> {
    const rows = await prisma.booking.findMany({
      where: {
        ...(filter.courtId ? { courtId: filter.courtId } : {}),
        ...(filter.range ? { startsAt: { gte: filter.range.start, lt: filter.range.end } } : {}),
      },
      include: withCourt,
      orderBy: { startsAt: "asc" },
    });
    return rows.map(toBookingDto);
  },

  /** Reservas não canceladas com startsAt no intervalo (dashboard). */
  async listActiveInRange(range: DayRange): Promise<Booking[]> {
    const rows = await prisma.booking.findMany({
      where: { startsAt: { gte: range.start, lt: range.end }, status: { not: "CANCELLED" } },
      include: withCourt,
      orderBy: { startsAt: "asc" },
    });
    return rows.map(toBookingDto);
  },

  async sumPriceByStatus(range: DayRange, statuses: BookingStatus[]): Promise<number> {
    const r = await prisma.booking.aggregate({
      _sum: { price: true },
      where: { startsAt: { gte: range.start, lt: range.end }, status: { in: statuses } },
    });
    return r._sum.price?.toNumber() ?? 0;
  },

  findById(id: string, db: Tx | typeof prisma = prisma) {
    return db.booking.findUnique({ where: { id } });
  },

  /** Existe reserva não cancelada na quadra sobrepondo [startsAt, endsAt)? */
  async hasConflict(
    db: Tx,
    courtId: string,
    startsAt: Date,
    endsAt: Date,
    excludeId?: string,
  ): Promise<boolean> {
    const n = await db.booking.count({
      where: {
        courtId,
        status: { not: "CANCELLED" },
        startsAt: { lt: endsAt },
        endsAt: { gt: startsAt },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });
    return n > 0;
  },

  /** Existe reserva não cancelada na quadra futura ou em andamento (término > agora)? */
  async hasUpcoming(db: Tx, courtId: string, now: Date): Promise<boolean> {
    const n = await db.booking.count({ where: { courtId, status: { not: "CANCELLED" }, endsAt: { gt: now } } });
    return n > 0;
  },

  /** Trava a linha da quadra para serializar checagem+insert por quadra. */
  async lockCourt(
    db: Tx,
    courtId: string,
  ): Promise<{ id: string; active: boolean; pricePerHour: Prisma.Decimal } | null> {
    const rows = await db.$queryRaw<
      { id: string; active: boolean; pricePerHour: Prisma.Decimal }[]
    >`SELECT id, active, "pricePerHour" FROM "Court" WHERE id = ${courtId} FOR UPDATE`;
    return rows[0] ?? null;
  },

  async create(
    db: Tx,
    data: {
      courtId: string;
      customerName: string;
      customerPhone: string;
      startsAt: Date;
      endsAt: Date;
      price: Prisma.Decimal;
    },
  ): Promise<Booking> {
    const row = await db.booking.create({ data, include: withCourt });
    return toBookingDto(row);
  },

  async updateStatus(db: Tx, id: string, status: BookingStatus): Promise<Booking> {
    const row = await db.booking.update({ where: { id }, data: { status }, include: withCourt });
    return toBookingDto(row);
  },
};
