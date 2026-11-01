import type { Court, CreateCourtInput } from "@marcai/shared";
import { prisma } from "../config/prisma.js";
import type { Court as DbCourt } from "../../generated/prisma/client.js";

export function toCourtDto(c: DbCourt): Court {
  return {
    id: c.id,
    name: c.name,
    sport: c.sport,
    pricePerHour: c.pricePerHour.toNumber(),
    active: c.active,
  };
}

export const courtModel = {
  async list(): Promise<Court[]> {
    const rows = await prisma.court.findMany({ orderBy: { name: "asc" } });
    return rows.map(toCourtDto);
  },

  async create(input: CreateCourtInput): Promise<Court> {
    const row = await prisma.court.create({
      data: {
        name: input.name,
        sport: input.sport,
        pricePerHour: input.pricePerHour,
        active: input.active ?? true,
      },
    });
    return toCourtDto(row);
  },

  findById(id: string): Promise<DbCourt | null> {
    return prisma.court.findUnique({ where: { id } });
  },

  async listActiveIds(): Promise<string[]> {
    const rows = await prisma.court.findMany({ where: { active: true }, select: { id: true } });
    return rows.map((r) => r.id);
  },
};
