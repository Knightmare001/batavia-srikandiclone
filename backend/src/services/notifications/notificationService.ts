import { and, count, desc, eq } from "drizzle-orm";
import { db } from "../../lib/db";
import { notifications } from "../../lib/schema";
import { ClientError, NotFoundError } from "../../exceptions/clientError";

export async function sendNotification(input: {
  userId: number;
  title: string;
  message: string;
  type: string;
  refId?: number | null;
  linkUrl?: string | null;
}) {
  await db
    .insert(notifications)
    .values({
      userId: input.userId,
      judul: input.title,
      pesan: input.message,
      tipe: input.type,
      referensiId: input.refId ?? null,
      linkUrl: input.linkUrl ?? null,
    });
}

export class NotificationService {
  async list(userId: number, page: number, limit: number) {
    const where = eq(notifications.userId, userId);
    const [[total], [unread], data] = await Promise.all([
      db.select({ total: count() }).from(notifications).where(where),
      db
        .select({ total: count() })
        .from(notifications)
        .where(and(where, eq(notifications.isRead, false))),
      db
        .select()
        .from(notifications)
        .where(where)
        .orderBy(desc(notifications.createdAt))
        .limit(limit)
        .offset((page - 1) * limit),
    ]);
    return {
      data,
      unread_count: Number(unread?.total ?? 0),
      pagination: {
        page,
        limit,
        total: Number(total?.total ?? 0),
        total_pages: Math.ceil(Number(total?.total ?? 0) / limit),
      },
    };
  }
  async read(userId: number, id: number) {
    const [row] = await db
      .select({ id: notifications.id })
      .from(notifications)
      .where(and(eq(notifications.id, id), eq(notifications.userId, userId)));
    if (!row) throw new NotFoundError("Notification not found");
    await db
      .update(notifications)
      .set({ isRead: true, readAt: new Date() })
      .where(and(eq(notifications.id, id), eq(notifications.userId, userId)));
  }
  async readAll(userId: number) {
    await db
      .update(notifications)
      .set({ isRead: true, readAt: new Date() })
      .where(
        and(eq(notifications.userId, userId), eq(notifications.isRead, false)),
      );
  }
}
export const notificationService = new NotificationService();
