import { Hono } from 'hono';
import { eq, desc } from 'drizzle-orm';
import { Bindings, Variables } from '../db';
import { tickets, ticketMessages, users } from 'database';
import { jwtMiddleware } from '../middleware/jwt';
import { generateBusinessId } from '../services/id-generator';

export const supportRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>();

supportRoutes.use('*', jwtMiddleware);

const generateId = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;

// GET /api/v1/support/tickets
supportRoutes.get('/tickets', async (c) => {
  const db = c.get('db');
  const user = c.get('user');

  try {
    const list = await db.select().from(tickets).where(eq(tickets.userId, user.id)).orderBy(desc(tickets.updatedAt)).all();
    return c.json({ success: true, data: list });
  } catch (error: any) {
    console.error('Error fetching tickets:', error);
    return c.json({ success: false, error: 'Failed to fetch tickets' }, 500);
  }
});

// POST /api/v1/support/tickets
supportRoutes.post('/tickets', async (c) => {
  const db = c.get('db');
  const user = c.get('user');
  const body = await c.req.json();

  if (!body.subject || !body.category || !body.message) {
    return c.json({ success: false, error: 'Missing required fields' }, 400);
  }

  try {
    const dbUser = await db.select().from(users).where(eq(users.id, user.id)).get();
    const displayId = await generateBusinessId(db, dbUser?.email, 'TICK');
    const ticketId = generateId('TIC');
    const now = new Date();

    await db.insert(tickets).values({
      id: ticketId,
      displayId,
      userId: user.id,
      subject: body.subject,
      category: body.category,
      priority: body.priority || 'MEDIUM',
      status: 'OPEN',
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(ticketMessages).values({
      id: generateId('MSG'),
      ticketId,
      senderId: user.id,
      isAdmin: false,
      content: body.message,
      createdAt: now,
    });

    const newTicket = await db.select().from(tickets).where(eq(tickets.id, ticketId)).get();
    return c.json({ success: true, data: newTicket });
  } catch (error: any) {
    console.error('Error creating ticket:', error);
    return c.json({ success: false, error: 'Failed to create ticket' }, 500);
  }
});

// GET /api/v1/support/tickets/:id/messages
supportRoutes.get('/tickets/:id/messages', async (c) => {
  const db = c.get('db');
  const ticketId = c.req.param('id');

  try {
    const messages = await db.select().from(ticketMessages).where(eq(ticketMessages.ticketId, ticketId)).orderBy(ticketMessages.createdAt).all();
    return c.json({ success: true, data: messages });
  } catch (error: any) {
    console.error('Error fetching messages:', error);
    return c.json({ success: false, error: 'Failed to fetch messages' }, 500);
  }
});

// POST /api/v1/support/tickets/:id/messages
supportRoutes.post('/tickets/:id/messages', async (c) => {
  const db = c.get('db');
  const user = c.get('user');
  const ticketId = c.req.param('id');
  const body = await c.req.json();

  if (!body.content && !body.attachmentBase64) {
    return c.json({ success: false, error: 'Missing content or attachment' }, 400);
  }

  try {
    const now = new Date();
    
    await db.insert(ticketMessages).values({
      id: generateId('MSG'),
      ticketId,
      senderId: user.id,
      isAdmin: false, // User is sending
      isInternalNote: false, // Users cannot send internal notes
      content: body.content || '',
      attachmentBase64: body.attachmentBase64 || null,
      createdAt: now,
    });

    await db.update(tickets)
      .set({ updatedAt: now, status: 'OPEN' })
      .where(eq(tickets.id, ticketId));

    return c.json({ success: true });
  } catch (error: any) {
    console.error('Error sending message:', error);
    return c.json({ success: false, error: 'Failed to send message' }, 500);
  }
});
