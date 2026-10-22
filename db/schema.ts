import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const onlineRooms = sqliteTable("online_rooms", {
  code: text("code").primaryKey(),
  hostId: text("host_id").notNull(),
  status: text("status").notNull(),
  settings: text("settings").notNull(),
  createdAt: integer("created_at").notNull(),
  expiresAt: integer("expires_at").notNull(),
  hostSeenAt: integer("host_seen_at").notNull(),
}, table => [index("online_rooms_expiry").on(table.expiresAt)]);

export const onlineMembers = sqliteTable("online_members", {
  id: text("id").primaryKey(),
  roomCode: text("room_code").notNull().references(() => onlineRooms.code, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull(),
  name: text("name").notNull(),
  team: text("team").notNull(),
  ready: integer("ready").notNull(),
  joinedAt: integer("joined_at").notNull(),
  lastSeen: integer("last_seen").notNull(),
  leftAt: integer("left_at"),
}, table => [index("online_members_room_team").on(table.roomCode, table.team, table.leftAt)]);

export const onlineMessages = sqliteTable("online_messages", {
  seq: integer("seq").primaryKey({ autoIncrement: true }),
  roomCode: text("room_code").notNull().references(() => onlineRooms.code, { onDelete: "cascade" }),
  senderId: text("sender_id").notNull().references(() => onlineMembers.id, { onDelete: "cascade" }),
  toId: text("to_id").notNull(),
  kind: text("kind").notNull(),
  data: text("data").notNull(),
  createdAt: integer("created_at").notNull(),
  expiresAt: integer("expires_at").notNull(),
}, table => [
  index("online_messages_room_seq").on(table.roomCode, table.seq),
  index("online_messages_rate").on(table.roomCode, table.senderId, table.kind, table.createdAt),
  index("online_messages_expiry").on(table.expiresAt),
]);
