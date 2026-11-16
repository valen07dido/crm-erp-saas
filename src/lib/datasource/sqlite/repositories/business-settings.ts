import { randomUUID } from 'crypto';
import { getDb } from '../connection';
import type { BusinessSettingsRecord, BusinessSettingsUpdateInput } from '../../types';

interface BusinessSettingsRow {
  id: string;
  business_id: string;
  currency: string;
  tax_rate: number;
  shift_morning_start_hour: number;
  shift_morning_end_hour: number;
  shift_night_start_hour: number;
  shift_night_end_hour: number;
  shift_morning_label: string;
  shift_night_label: string;
  ticket_width_mm: number;
  print_ticket_on_sale: number;
  print_left_offset_mm: number;
}

function mapRow(row: BusinessSettingsRow): BusinessSettingsRecord {
  return {
    id: row.id,
    businessId: row.business_id,
    currency: row.currency,
    taxRate: row.tax_rate,
    shiftMorningStartHour: row.shift_morning_start_hour,
    shiftMorningEndHour: row.shift_morning_end_hour,
    shiftNightStartHour: row.shift_night_start_hour,
    shiftNightEndHour: row.shift_night_end_hour,
    shiftMorningLabel: row.shift_morning_label,
    shiftNightLabel: row.shift_night_label,
    ticketWidthMm: row.ticket_width_mm,
    printTicketOnSale: !!row.print_ticket_on_sale,
    printLeftOffsetMm: row.print_left_offset_mm,
  };
}

function clampHour(h: number): number {
  return Math.min(23, Math.max(0, h));
}
function clampTaxRate(t: number): number {
  return Math.min(100, Math.max(0, t));
}
function clampOffset(v: number): number {
  return Math.min(30, Math.max(0, v));
}

function findOrCreate(businessId: string): BusinessSettingsRow {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM business_settings WHERE business_id = ?').get(businessId) as
    | BusinessSettingsRow
    | undefined;
  if (existing) return existing;

  const id = randomUUID();
  db.prepare(
    `INSERT INTO business_settings (id, business_id, currency, tax_rate,
      shift_morning_start_hour, shift_morning_end_hour, shift_night_start_hour, shift_night_end_hour,
      shift_morning_label, shift_night_label, ticket_width_mm, print_ticket_on_sale)
     VALUES (?, ?, 'USD', 0, 8, 12, 16, 21, 'Turno Mañana', 'Turno Noche', 58, 0)`
  ).run(id, businessId);
  return db.prepare('SELECT * FROM business_settings WHERE id = ?').get(id) as BusinessSettingsRow;
}

export const businessSettingsRepository = {
  async get(businessId: string): Promise<BusinessSettingsRecord> {
    return mapRow(findOrCreate(businessId));
  },

  async update(businessId: string, input: BusinessSettingsUpdateInput): Promise<BusinessSettingsRecord> {
    const db = getDb();
    const existing = findOrCreate(businessId);

    const next = {
      currency: input.currency !== undefined ? input.currency : existing.currency,
      taxRate: input.taxRate !== undefined ? clampTaxRate(input.taxRate) : existing.tax_rate,
      shiftMorningStartHour:
        input.shiftMorningStartHour !== undefined ? clampHour(input.shiftMorningStartHour) : existing.shift_morning_start_hour,
      shiftMorningEndHour:
        input.shiftMorningEndHour !== undefined ? clampHour(input.shiftMorningEndHour) : existing.shift_morning_end_hour,
      shiftNightStartHour:
        input.shiftNightStartHour !== undefined ? clampHour(input.shiftNightStartHour) : existing.shift_night_start_hour,
      shiftNightEndHour:
        input.shiftNightEndHour !== undefined ? clampHour(input.shiftNightEndHour) : existing.shift_night_end_hour,
      shiftMorningLabel: input.shiftMorningLabel !== undefined ? input.shiftMorningLabel : existing.shift_morning_label,
      shiftNightLabel: input.shiftNightLabel !== undefined ? input.shiftNightLabel : existing.shift_night_label,
      ticketWidthMm:
        input.ticketWidthMm !== undefined ? Math.min(300, Math.max(30, input.ticketWidthMm)) : existing.ticket_width_mm,
      printTicketOnSale:
        input.printTicketOnSale !== undefined ? (input.printTicketOnSale ? 1 : 0) : existing.print_ticket_on_sale,
      printLeftOffsetMm:
        input.printLeftOffsetMm !== undefined ? clampOffset(input.printLeftOffsetMm) : existing.print_left_offset_mm,
    };

    db.prepare(
      `UPDATE business_settings SET currency=@currency, tax_rate=@taxRate,
        shift_morning_start_hour=@shiftMorningStartHour, shift_morning_end_hour=@shiftMorningEndHour,
        shift_night_start_hour=@shiftNightStartHour, shift_night_end_hour=@shiftNightEndHour,
        shift_morning_label=@shiftMorningLabel, shift_night_label=@shiftNightLabel,
        ticket_width_mm=@ticketWidthMm, print_ticket_on_sale=@printTicketOnSale, print_left_offset_mm=@printLeftOffsetMm
       WHERE business_id = @businessId`
    ).run({ ...next, businessId });

    return mapRow(db.prepare('SELECT * FROM business_settings WHERE business_id = ?').get(businessId) as BusinessSettingsRow);
  },
};
