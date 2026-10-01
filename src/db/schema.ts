import { relations } from 'drizzle-orm';
import { integer, pgTable, serial, text, timestamp, boolean, doublePrecision, varchar } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(), // Firebase Auth UID
  email: text('email').notNull(),
  role: varchar('role', { length: 50 }).default('user'), // 'admin', 'supervisor', 'user'
  createdAt: timestamp('created_at').defaultNow(),
});

export const gpsLogs = pgTable('gps_logs', {
  id: serial('id').primaryKey(),
  routeId: integer('route_id').notNull(),
  lat: doublePrecision('lat').notNull(),
  lng: doublePrecision('lng').notNull(),
  timestamp: timestamp('timestamp').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const payrolls = pgTable('payrolls', {
  id: serial('id').primaryKey(),
  routeId: integer('route_id').notNull(),
  routeName: text('route_name').notNull(),
  startDate: timestamp('start_date').notNull(),
  endDate: timestamp('end_date').notNull(),
  baseSalary: doublePrecision('base_salary').notNull().default(0),
  totalCommissions: doublePrecision('total_commissions').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow(),
});

export const commissions = pgTable('commissions', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id').notNull().unique(), // Odoo POS Order ID
  orderName: text('order_name').notNull(),
  routeId: integer('route_id').notNull(),
  clientId: integer('client_id'), // Odoo Partner ID
  clientName: text('client_name'),
  clientType: varchar('client_type', { length: 50 }), // 'person' or 'company'
  orderTotal: doublePrecision('order_total').notNull(),
  commissionAmount: doublePrecision('commission_amount').notNull(),
  commissionRate: doublePrecision('commission_rate').notNull(),
  isPaid: boolean('is_paid').notNull().default(false),
  isLiquidated: boolean('is_liquidated').notNull().default(true), // True if fully paid in Odoo or marked manually
  dateOrder: timestamp('date_order').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const appStateTable = pgTable('app_state', {
  key: text('key').primaryKey(),
  data: text('data').notNull(), // Master JSON state string
  updatedAt: timestamp('updated_at').defaultNow(),
});

