import { Hono } from 'hono';
import { Bindings, Variables } from '../db';
import { jwtMiddleware, adminMiddleware } from '../middleware/jwt';
import { eq, desc } from 'drizzle-orm';
import { kycProfiles } from 'database/schema/kyc';
import { users } from 'database/schema/auth';

const adminKycRouter = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// Apply admin auth middleware to all routes in this router
adminKycRouter.use('*', jwtMiddleware);
adminKycRouter.use('*', adminMiddleware);

// GET /api/v1/admin/kyc - Get list of KYC applications
adminKycRouter.get('/', async (c) => {
  const db = c.get('db');
  
  try {
    // Left join with users to get email
    const applications = await db
      .select({
        id: kycProfiles.id,
        displayId: kycProfiles.displayId,
        userId: kycProfiles.userId,
        email: users.email,
        firstName: kycProfiles.firstName,
        lastName: kycProfiles.lastName,
        country: kycProfiles.country,
        documentType: kycProfiles.documentType,
        status: kycProfiles.status,
        createdAt: kycProfiles.createdAt,
      })
      .from(kycProfiles)
      .leftJoin(users, eq(kycProfiles.userId, users.id))
      .orderBy(desc(kycProfiles.createdAt))
      .all();
      
    return c.json({ success: true, data: applications });
  } catch (error) {
    console.error('Error fetching KYC applications:', error);
    return c.json({ success: false, error: 'Failed to fetch KYC applications' }, 500);
  }
});

// GET /api/v1/admin/kyc/:id - Get specific KYC application details
adminKycRouter.get('/:id', async (c) => {
  const id = c.req.param('id');
  const db = c.get('db');
  
  try {
    const application = await db
      .select({
        id: kycProfiles.id,
        displayId: kycProfiles.displayId,
        userId: kycProfiles.userId,
        email: users.email,
        firstName: kycProfiles.firstName,
        lastName: kycProfiles.lastName,
        dateOfBirth: kycProfiles.dateOfBirth,
        country: kycProfiles.country,
        documentType: kycProfiles.documentType,
        documentNumber: kycProfiles.documentNumber,
        documentFrontUrl: kycProfiles.documentFrontUrl,
        documentBackUrl: kycProfiles.documentBackUrl,
        selfieUrl: kycProfiles.selfieUrl,
        status: kycProfiles.status,
        rejectionReason: kycProfiles.rejectionReason,
        createdAt: kycProfiles.createdAt,
      })
      .from(kycProfiles)
      .leftJoin(users, eq(kycProfiles.userId, users.id))
      .where(eq(kycProfiles.id, id))
      .get();
      
    if (!application) {
      return c.json({ success: false, error: 'Application not found' }, 404);
    }
    
    return c.json({ success: true, data: application });
  } catch (error) {
    console.error('Error fetching KYC application:', error);
    return c.json({ success: false, error: 'Failed to fetch KYC application' }, 500);
  }
});

// POST /api/v1/admin/kyc/:id/approve - Approve KYC
adminKycRouter.post('/:id/approve', async (c) => {
  const id = c.req.param('id');
  const db = c.get('db');
  const user = c.get('user'); // Admin user
  
  try {
    const profile = await db.select().from(kycProfiles).where(eq(kycProfiles.id, id)).get();
    if (!profile) return c.json({ success: false, error: 'Not found' }, 404);
    
    if (profile.status === 'APPROVED') {
      return c.json({ success: false, error: 'Already approved' }, 400);
    }

    const now = new Date();
    await db.update(kycProfiles)
      .set({ status: 'APPROVED', reviewedBy: user.id, updatedAt: now })
      .where(eq(kycProfiles.id, id));
      
    // Optionally update user level/status here if needed
    // await db.update(users).set({ kycLevel: 1 }).where(eq(users.id, profile.userId));
      
    return c.json({ success: true, message: 'KYC approved successfully' });
  } catch (error) {
    console.error('Error approving KYC:', error);
    return c.json({ success: false, error: 'Failed to approve KYC' }, 500);
  }
});

// POST /api/v1/admin/kyc/:id/reject - Reject KYC
adminKycRouter.post('/:id/reject', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const db = c.get('db');
  const user = c.get('user'); // Admin user
  
  if (!body.reason) {
    return c.json({ success: false, error: 'Rejection reason is required' }, 400);
  }
  
  try {
    const profile = await db.select().from(kycProfiles).where(eq(kycProfiles.id, id)).get();
    if (!profile) return c.json({ success: false, error: 'Not found' }, 404);
    
    const now = new Date();
    await db.update(kycProfiles)
      .set({ status: 'REJECTED', rejectionReason: body.reason, reviewedBy: user.id, updatedAt: now })
      .where(eq(kycProfiles.id, id));
      
    return c.json({ success: true, message: 'KYC rejected' });
  } catch (error) {
    console.error('Error rejecting KYC:', error);
    return c.json({ success: false, error: 'Failed to reject KYC' }, 500);
  }
});

export default adminKycRouter;
