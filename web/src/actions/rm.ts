"use server";

import prisma, { DBClient } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";

function safeRevalidate(path: string) {
  try {
    revalidatePath(path);
  } catch {
    // Outside Next.js context
  }
  if (path.includes("relationship-managers") || path.includes("rm")) {
    invalidatePublicRmsCache();
  }
}

async function verifyAuthUser(): Promise<any> {
  const session = await getSession();
  if (!session || !session.userId) {
    throw new Error("Authentication required. Please log in.");
  }
  const user: any = await prisma.user.findUnique({
    where: { id: session.userId },
    include: { rmProfile: true },
  });
  if (!user) {
    throw new Error("User account not found.");
  }
  if (user.status === "BANNED" || user.status === "FROZEN") {
    throw new Error("Your account has been suspended or frozen.");
  }
  return user;
}

// ==========================================
// 1. RM LISTING & DISCOVERY
// ==========================================

function sanitizeRmCode(code: string | null | undefined, fallbackUid?: number | string): string {
  if (!code) return fallbackUid ? `RM-${fallbackUid}` : "RM";
  const trimmed = code.trim();
  // Security guard: Never expose values with password-like special characters (@, #, $, %, etc.)
  if (/[@#$%^&*+=<>?/\\]/.test(trimmed)) {
    return fallbackUid ? `RM-${fallbackUid}` : "RM";
  }
  return trimmed;
}

// High-performance edge cache for public RM discovery
let cachedPublicRms: any[] | null = null;
let lastPublicRmsFetch = 0;
const PUBLIC_RMS_CACHE_TTL = 30000; // 30 seconds

export async function invalidatePublicRmsCache() {
  cachedPublicRms = null;
  lastPublicRmsFetch = 0;
}

export async function getAvailableRms(params?: { search?: string; service?: string }) {
  try {
    const session = await getSession();
    const currentUserId = session?.userId;
    const isPublicDefaultQuery = !currentUserId && !params?.search;

    if (isPublicDefaultQuery && cachedPublicRms && Date.now() - lastPublicRmsFetch < PUBLIC_RMS_CACHE_TTL) {
      return { success: true, rms: cachedPublicRms, cached: true };
    }

    const where: any = {
      role: "RM",
      status: "ACTIVE",
    };

    if (params?.search) {
      const q = params.search.toLowerCase();
      const numQ = Number(q);
      const orConditions: any[] = [
        { name: { contains: q } },
        { email: { contains: q } },
        { rmProfile: { rmCode: { contains: q } } },
        { rmProfile: { designation: { contains: q } } },
        { rmProfile: { specialties: { contains: q } } },
      ];
      if (!isNaN(numQ) && numQ > 0) {
        orConditions.push({ uid: numQ });
      }
      where.OR = orConditions;
    }

    const rms = await prisma.user.findMany({
      where,
      select: {
        id: true,
        uid: true,
        name: true,
        email: true,
        avatarUrl: true,
        rmProfile: true,
        _count: {
          select: {
            rmManagedConnections: {
              where: { status: "ACTIVE" },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // If a user is logged in, attach their current connection & contract state for each RM, and their review
    let userConnections: Record<string, any> = {};
    let userReviews: Record<string, { id: string; rating: number; comment?: string | null; createdAt: Date }> = {};
    if (currentUserId) {
      const [connections, reviews] = await Promise.all([
        prisma.rmConnection.findMany({
          where: { userId: currentUserId },
          include: {
            contracts: {
              orderBy: { createdAt: "desc" },
              take: 1,
            },
          },
        }),
        prisma.rmReview.findMany({
          where: { userId: currentUserId },
          select: { id: true, rmId: true, rating: true, comment: true, createdAt: true },
        }),
      ]);

      for (const conn of connections) {
        userConnections[conn.rmId] = {
          connectionId: conn.id,
          status: conn.status,
          requestedAt: conn.requestedAt,
          activatedAt: conn.activatedAt,
          contract: conn.contracts[0] || null,
        };
      }

      for (const rev of reviews) {
        userReviews[rev.rmId] = {
          id: rev.id,
          rating: rev.rating,
          comment: rev.comment,
          createdAt: rev.createdAt,
        };
      }
    }

    const mapped = rms.map((rm: any) => {
      const userConn = userConnections[rm.id] || null;
      const userRev = userReviews[rm.id] || null;
      const totalRatings = rm.rmProfile?.totalRatings || 0;
      const actualRating = totalRatings > 0 ? Number(rm.rmProfile?.rating || 0) : 0;

      return {
        id: rm.id,
        uid: rm.uid,
        name: rm.name || "Relationship Manager",
        email: rm.email,
        avatarUrl: rm.avatarUrl || rm.rmProfile?.avatarUrl || null,
        rmCode: sanitizeRmCode(rm.rmProfile?.rmCode, rm.uid),
        designation: rm.rmProfile?.designation || "Senior Crypto Relationship Manager",
        department: rm.rmProfile?.department || "Private Wealth & Institutional Trading",
        bio: rm.rmProfile?.bio || "Experienced digital asset advisor.",
        specialties: rm.rmProfile?.specialties || "Perpetual Futures, Spot Hedging, Options",
        rating: actualRating,
        totalRatings,
        experienceYears: rm.rmProfile?.experienceYears || 0,
        workingHours: rm.rmProfile?.workingHours || "09:00 - 21:00 UTC",
        phone: rm.rmProfile?.phone || null,
        activeClientsCount: rm._count.rmManagedConnections,
        maxClients: rm.rmProfile?.maxClients || 50,
        userRelationship: userConn,
        userReview: userRev,
      };
    });

    if (isPublicDefaultQuery) {
      cachedPublicRms = mapped;
      lastPublicRmsFetch = Date.now();
    }

    return { success: true, rms: mapped };
  } catch (error: any) {
    console.error("getAvailableRms error:", error);
    return { success: false, error: error.message || "Failed to load Relationship Managers", rms: [] };
  }
}

export async function getRmPublicProfile(rmId: string): Promise<{ success: boolean; rm?: any; error?: string }> {
  try {
    const rm: any = await prisma.user.findFirst({
      where: { id: rmId, role: "RM" },
      include: {
        rmProfile: true,
        _count: {
          select: {
            rmManagedConnections: { where: { status: "ACTIVE" } },
          },
        },
      },
    });

    if (!rm) {
      return { success: false, error: "Relationship Manager not found" };
    }

    return {
      success: true,
      rm: {
        id: rm.id,
        uid: rm.uid,
        name: rm.name,
        email: rm.email,
        avatarUrl: rm.avatarUrl || rm.rmProfile?.avatarUrl,
        rmCode: sanitizeRmCode(rm.rmProfile?.rmCode, rm.uid),
        designation: rm.rmProfile?.designation,
        department: rm.rmProfile?.department,
        bio: rm.rmProfile?.bio,
        specialties: rm.rmProfile?.specialties,
        rating: (rm.rmProfile?.totalRatings || 0) > 0 ? Number(rm.rmProfile?.rating || 0) : 0,
        totalRatings: rm.rmProfile?.totalRatings || 0,
        experienceYears: rm.rmProfile?.experienceYears || 0,
        workingHours: rm.rmProfile?.workingHours,
        phone: rm.rmProfile?.phone,
        activeClientsCount: rm._count.rmManagedConnections,
        maxClients: rm.rmProfile?.maxClients,
        status: rm.rmProfile?.status,
      },
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// ==========================================
// 2. USER CONNECTION REQUEST WORKFLOW
// ==========================================

export async function sendRmConnectionRequest(rmId: string, message?: string) {
  try {
    const user = await verifyAuthUser();

    if (user.id === rmId) {
      return { success: false, error: "You cannot connect with your own account." };
    }

    const rm: any = await prisma.user.findFirst({
      where: { id: rmId, role: "RM", status: "ACTIVE" },
      include: { rmProfile: true },
    });

    if (!rm) {
      return { success: false, error: "The selected Relationship Manager is currently unavailable." };
    }

    // Check existing connection
    const existing = await prisma.rmConnection.findUnique({
      where: {
        userId_rmId: {
          userId: user.id,
          rmId: rm.id,
        },
      },
      include: {
        contracts: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    if (existing) {
      if (existing.status === "REQUESTED") {
        return { success: false, error: "A connection request is already pending with this RM." };
      }
      if (existing.status === "ACTIVE") {
        return { success: false, error: "You already have an active contract & relationship with this RM." };
      }
      if (existing.status === "CONTRACT_PENDING" || existing.status === "ACCEPTED") {
        return {
          success: true,
          message: "Connection already accepted. Please sign your pending contract.",
          connectionId: existing.id,
          contractId: existing.contracts[0]?.id || null,
        };
      }

      // Reconnecting if previously REJECTED or CANCELLED or TERMINATED
      const updated = await prisma.rmConnection.update({
        where: { id: existing.id },
        data: {
          status: "REQUESTED",
          requestMessage: message?.trim() || "Client requested advisory connection.",
          requestedAt: new Date(),
          respondedAt: null,
          responseNotes: null,
        },
      });

      // Send notification to RM
      await prisma.rmNotification.create({
        data: {
          userId: rm.id,
          title: "New Client Connection Request",
          message: `Trader ${user.name || user.email} (UID: #${user.uid}) sent you a connection request.`,
          type: "RM_REQUEST",
          linkUrl: "/rm/dashboard",
        },
      });

      safeRevalidate("/relationship-managers");
      safeRevalidate("/rm/dashboard");
      return { success: true, connectionId: updated.id, message: "Connection request sent successfully." };
    }

    // Create fresh connection request
    const connection = await prisma.rmConnection.create({
      data: {
        userId: user.id,
        rmId: rm.id,
        status: "REQUESTED",
        requestMessage: message?.trim() || "Client requested advisory connection.",
      },
    });

    // Send in-app notification to RM
    await prisma.rmNotification.create({
      data: {
        userId: rm.id,
        title: "New Client Connection Request",
        message: `Trader ${user.name || user.email} (UID: #${user.uid}) sent you a connection request.`,
        type: "RM_REQUEST",
        linkUrl: "/rm/dashboard",
      },
    });

    safeRevalidate("/relationship-managers");
    safeRevalidate("/rm/dashboard");
    return { success: true, connectionId: connection.id, message: "Connection request sent successfully." };
  } catch (error: any) {
    console.error("sendRmConnectionRequest error:", error);
    return { success: false, error: error.message || "Failed to send connection request." };
  }
}

export async function cancelRmConnectionRequest(connectionId: string) {
  try {
    const user = await verifyAuthUser();

    const connection = await prisma.rmConnection.findUnique({
      where: { id: connectionId },
    });

    if (!connection || connection.userId !== user.id) {
      return { success: false, error: "Connection request not found or unauthorized." };
    }

    if (connection.status !== "REQUESTED") {
      return { success: false, error: "Only pending connection requests can be cancelled." };
    }

    await prisma.rmConnection.update({
      where: { id: connectionId },
      data: { status: "CANCELLED" },
    });

    safeRevalidate("/relationship-managers");
    safeRevalidate("/rm/dashboard");
    return { success: true, message: "Connection request cancelled." };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// ==========================================
// 3. RM DASHBOARD & REQUEST PROCESSING
// ==========================================

export async function getRmDashboardData() {
  try {
    const user = await verifyAuthUser();

    if (user.role !== "RM" && user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
      return { success: false, error: "Unauthorized: Access restricted to Relationship Managers." };
    }

    const rmId = user.id;

    // Fetch summary stats
    const [
      pendingRequestsCount,
      activeClientsCount,
      pendingContractsCount,
      unreadMessagesCount,
      pendingRequests,
      activeClients,
      contracts,
      conversations,
    ] = await Promise.all([
      prisma.rmConnection.count({ where: { rmId, status: "REQUESTED" } }),
      prisma.rmConnection.count({ where: { rmId, status: "ACTIVE" } }),
      prisma.investmentContract.count({
        where: {
          rmId,
          status: { in: ["PENDING_SIGNATURE", "PARTIALLY_SIGNED"] },
        },
      }),
      prisma.rmMessage.count({
        where: {
          conversation: { rmId },
          senderId: { not: rmId },
          isRead: false,
        },
      }),
      prisma.rmConnection.findMany({
        where: { rmId, status: "REQUESTED" },
        include: {
          user: {
            select: {
              id: true,
              uid: true,
              name: true,
              email: true,
              avatarUrl: true,
              isKycVerified: true,
              wallets: { select: { asset: true, balance: true, type: true } },
            },
          },
        },
        orderBy: { requestedAt: "desc" },
      }),
      prisma.rmConnection.findMany({
        where: { rmId, status: { in: ["ACTIVE", "CONTRACT_PENDING", "ACCEPTED"] } },
        include: {
          user: {
            select: {
              id: true,
              uid: true,
              name: true,
              email: true,
              avatarUrl: true,
              isKycVerified: true,
              wallets: { select: { asset: true, balance: true, type: true } },
            },
          },
          contracts: {
            orderBy: { createdAt: "desc" },
            take: 1,
          },
          conversation: {
            select: {
              id: true,
              lastMessageAt: true,
              _count: {
                select: {
                  messages: {
                    where: { senderId: { not: rmId }, isRead: false },
                  },
                },
              },
            },
          },
        },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.investmentContract.findMany({
        where: { rmId },
        include: {
          user: { select: { id: true, uid: true, name: true, email: true } },
          connection: { select: { id: true, status: true } },
        },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.rmConversation.findMany({
        where: { rmId, isActive: true },
        include: {
          connection: { select: { id: true, status: true } },
          user: { select: { id: true, uid: true, name: true, email: true, avatarUrl: true } },
          messages: {
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
        orderBy: { lastMessageAt: "desc" },
      }),
    ]);

    return {
      success: true,
      stats: {
        pendingRequestsCount,
        activeClientsCount,
        pendingContractsCount,
        unreadMessagesCount,
      },
      pendingRequests,
      activeClients,
      contracts,
      conversations,
      rmProfile: user.rmProfile,
    };
  } catch (error: any) {
    console.error("getRmDashboardData error:", error);
    return { success: false, error: error.message };
  }
}

export async function respondToConnectionRequest(
  connectionId: string,
  action: "ACCEPT" | "REJECT",
  notes?: string
) {
  try {
    const user = await verifyAuthUser();

    const connection = await prisma.rmConnection.findUnique({
      where: { id: connectionId },
      include: {
        user: true,
        rm: { include: { rmProfile: true } },
      },
    });

    if (!connection) {
      return { success: false, error: "Connection request not found." };
    }

    if (
      connection.rmId !== user.id &&
      user.role !== "ADMIN" &&
      user.role !== "SUPER_ADMIN"
    ) {
      return { success: false, error: "Unauthorized to process this connection request." };
    }

    if (action === "REJECT") {
      await prisma.rmConnection.update({
        where: { id: connectionId },
        data: {
          status: "REJECTED",
          responseNotes: notes?.trim() || "RM declined connection at this time.",
          respondedAt: new Date(),
        },
      });

      await prisma.rmNotification.create({
        data: {
          userId: connection.userId,
          title: "Connection Request Declined",
          message: `Your connection request with RM ${connection.rm?.name || connection.rm?.email || "Relationship Manager"} was declined: ${notes || "No reason specified."}`,
          type: "RM_REJECTED",
          linkUrl: "/relationship-managers",
        },
      });

      safeRevalidate("/rm/dashboard");
      safeRevalidate("/relationship-managers");
      return { success: true, message: "Connection request rejected." };
    }

    // ACCEPT: Create or activate Investment Contract
    const clientUid = connection.user?.uid || 0;
    const contractNumber = `ETH-AGR-${Date.now().toString().slice(-6)}-${clientUid}`;

    const rmName = connection.rm?.name || "Relationship Manager";
    const rmCode = connection.rm?.rmProfile?.rmCode || `RM-${connection.rm?.uid || 0}`;
    const clientName = connection.user?.name || connection.user?.email || "Client";

    // Default terms text
    const standardTerms = getStandardContractTerms({
      contractNumber,
      rmName,
      rmCode,
      clientName,
      clientUid,
    });

    const [updatedConnection, contract] = await prisma.$transaction(async (tx: DBClient) => {
      const conn = await tx.rmConnection.update({
        where: { id: connectionId },
        data: {
          status: "CONTRACT_PENDING",
          respondedAt: new Date(),
          responseNotes: notes?.trim() || "Accepted. Contract initialized for signatures.",
        },
        include: {
          user: true,
          rm: { include: { rmProfile: true } },
        },
      });

      // Check if existing draft contract exists
      const existingContract = await tx.investmentContract.findFirst({
        where: { connectionId: conn.id },
      });

      if (existingContract) {
        return [conn, existingContract];
      }

      const partyAName = `${conn.rm?.name || rmName} (${conn.rm?.rmProfile?.rmCode || rmCode})`;
      const partyBName = `${conn.user?.name || clientName} (UID: #${conn.user?.uid || clientUid})`;

      const newContract = await tx.investmentContract.create({
        data: {
          contractNumber,
          connectionId: conn.id,
          userId: conn.userId,
          rmId: conn.rmId,
          title: "ETH Investment Contract",
          version: "1.0.0",
          status: "PENDING_SIGNATURE",
          partyAName,
          partyARole: "Licensed Relationship Manager (Party A)",
          partyBName,
          partyBRole: "Investor / Trader Client (Party B)",
          termsText: standardTerms,
          companyLegalName: "ETHSLTD Financial Technology Research Group",
          websiteUrl: "https://www.ethsltd.com",
          jurisdiction: "Virtual Currency International Investment Contract Law",
          auditTrail: JSON.stringify([
            {
              action: "CONTRACT_CREATED",
              timestamp: new Date().toISOString(),
              by: user.email,
              role: user.role,
            },
          ]),
        },
      });

      return [conn, newContract];
    });

    // Notify user that contract is ready for signing
    await prisma.rmNotification.create({
      data: {
        userId: connection.userId,
        title: "Connection Accepted - Contract Ready for Signature",
        message: `Your request with RM ${connection.rm?.name || connection.rm?.email || "Relationship Manager"} was accepted! Please review and sign your ETH Investment Contract.`,
        type: "CONTRACT_READY",
        linkUrl: `/contracts/${contract.id}`,
      },
    });

    safeRevalidate("/rm/dashboard");
    safeRevalidate("/relationship-managers");
    return {
      success: true,
      message: "Connection accepted! Contract generated for digital signature.",
      contractId: contract.id,
    };
  } catch (error: any) {
    console.error("respondToConnectionRequest error:", error);
    return { success: false, error: error.message };
  }
}

// ==========================================
// 4. CONTRACT SYSTEM & DIGITAL SIGNATURES
// ==========================================

export async function getContractById(contractId: string) {
  try {
    const session = await getSession();
    const currentUserId = session?.userId;

    const contract = await prisma.investmentContract.findUnique({
      where: { id: contractId },
      include: {
        user: { select: { id: true, uid: true, name: true, email: true, avatarUrl: true } },
        rm: {
          select: {
            id: true,
            uid: true,
            name: true,
            email: true,
            avatarUrl: true,
            rmProfile: true,
          },
        },
        connection: true,
      },
    });

    if (!contract) {
      return { success: false, error: "Contract document not found." };
    }

    const isAdmin = session?.role === "ADMIN" || session?.role === "SUPER_ADMIN";
    const isPartyA = currentUserId === contract.rmId;
    const isPartyB = currentUserId === contract.userId;

    if (!isAdmin && !isPartyA && !isPartyB) {
      return { success: false, error: "Access denied. You are not a signatory to this contract." };
    }

    return {
      success: true,
      contract,
      currentUserId,
      permissions: {
        canSignPartyA: (isPartyA || isAdmin) && !contract.partyASignature && contract.status !== "FULLY_SIGNED",
        canSignPartyB: (isPartyB || isAdmin) && !contract.partyBSignature && contract.status !== "FULLY_SIGNED",
        isPartyA,
        isPartyB,
        isAdmin,
      },
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function signInvestmentContract(data: {
  contractId: string;
  signatureBase64: string;
  party: "PARTY_A" | "PARTY_B";
}) {
  try {
    const user = await verifyAuthUser();
    const { contractId, signatureBase64, party } = data;

    if (!signatureBase64 || !signatureBase64.startsWith("data:image/")) {
      return { success: false, error: "Invalid signature format. Please draw your digital signature." };
    }

    const contract = await prisma.investmentContract.findUnique({
      where: { id: contractId },
      include: {
        user: true,
        rm: { include: { rmProfile: true } },
        connection: true,
      },
    });

    if (!contract) {
      return { success: false, error: "Contract not found." };
    }

    if (contract.status === "FULLY_SIGNED") {
      return { success: false, error: "This contract is already fully signed and sealed." };
    }

    const isAdmin = user.role === "ADMIN" || user.role === "SUPER_ADMIN";
    const isRmSigner = party === "PARTY_A";
    const isClientSigner = party === "PARTY_B";

    if (isRmSigner) {
      if (user.id !== contract.rmId && !isAdmin) {
        return { success: false, error: "Only the designated Relationship Manager can sign Party A." };
      }
    }

    if (isClientSigner) {
      if (user.id !== contract.userId && !isAdmin) {
        return { success: false, error: "Only the designated Client can sign Party B." };
      }
    }

    const now = new Date();
    const existingAudit = contract.auditTrail ? JSON.parse(contract.auditTrail) : [];
    existingAudit.push({
      action: `${party}_SIGNED`,
      timestamp: now.toISOString(),
      signerId: user.id,
      signerUid: user.uid,
      signerEmail: user.email,
      role: user.role,
    });

    // Check if after this signature, both parties are signed
    const partyASigned = isRmSigner ? true : Boolean(contract.partyASignature);
    const partyBSigned = isClientSigner ? true : Boolean(contract.partyBSignature);
    const isNowFullySigned = partyASigned && partyBSigned;

    const newStatus = isNowFullySigned ? "FULLY_SIGNED" : "PARTIALLY_SIGNED";

    const updateData: any = {
      status: newStatus,
      auditTrail: JSON.stringify(existingAudit),
    };

    if (isRmSigner) {
      updateData.partyASignature = signatureBase64;
      updateData.partyASignedAt = now;
      updateData.partyASignerUid = user.uid;
    } else {
      updateData.partyBSignature = signatureBase64;
      updateData.partyBSignedAt = now;
      updateData.partyBSignerUid = user.uid;
    }

    if (isNowFullySigned) {
      updateData.effectiveDate = now;
      // Valid for 1 year
      updateData.expiresAt = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
    }

    await prisma.$transaction(async (tx: DBClient) => {
      await tx.investmentContract.update({
        where: { id: contractId },
        data: updateData,
      });

      if (isNowFullySigned) {
        // Activate connection!
        await tx.rmConnection.update({
          where: { id: contract.connectionId },
          data: {
            status: "ACTIVE",
            activatedAt: now,
          },
        });

        // Initialize or activate private conversation
        await tx.rmConversation.upsert({
          where: { connectionId: contract.connectionId },
          update: { isActive: true },
          create: {
            connectionId: contract.connectionId,
            userId: contract.userId,
            rmId: contract.rmId,
            isActive: true,
          },
        });

        // Create welcome system message
        const conv = await tx.rmConversation.findUnique({
          where: { connectionId: contract.connectionId },
        });

        if (conv) {
          await tx.rmMessage.create({
            data: {
              conversationId: conv.id,
              senderId: contract.rmId,
              text: `Welcome! Your ETH Investment Contract (${contract.contractNumber}) is fully signed and active. I am ${contract.rm?.name || "your Relationship Manager"}. You may now send private messages and receive direct trading advisory.`,
            },
          });
        }
      }
    });

    // Notify parties
    if (isNowFullySigned) {
      await prisma.rmNotification.createMany({
        data: [
          {
            userId: contract.userId,
            title: "Investment Contract Fully Signed & Active!",
            message: `Contract ${contract.contractNumber} is fully executed! Private chat with RM ${contract.rm?.name || "your RM"} is now open.`,
            type: "CONTRACT_SIGNED",
            linkUrl: `/rm/chat/${contract.connectionId}`,
          },
          {
            userId: contract.rmId,
            title: "Client Contract Fully Executed!",
            message: `Contract with ${contract.user?.name || contract.user?.email || "Client"} (UID: #${contract.user?.uid || 0}) is fully signed. Private messaging is active.`,
            type: "CONTRACT_SIGNED",
            linkUrl: `/rm/chat/${contract.connectionId}`,
          },
        ],
      });
    } else {
      // Notify other party to sign
      const notifyUserId = isRmSigner ? contract.userId : contract.rmId;
      const signerTitle = isRmSigner ? "Relationship Manager" : "Client";
      await prisma.rmNotification.create({
        data: {
          userId: notifyUserId,
          title: `Contract Partially Signed by ${signerTitle}`,
          message: `${user.name || user.email} has signed. Please add your signature to finalize the agreement.`,
          type: "CONTRACT_READY",
          linkUrl: `/contracts/${contract.id}`,
        },
      });
    }

    safeRevalidate(`/contracts/${contractId}`);
    safeRevalidate("/rm/dashboard");
    safeRevalidate("/relationship-managers");

    return {
      success: true,
      message: isNowFullySigned
        ? "Contract fully signed! Active status and Private Chat unlocked."
        : "Signature saved. Waiting for other party to sign.",
      isFullySigned: isNowFullySigned,
    };
  } catch (error: any) {
    console.error("signInvestmentContract error:", error);
    return { success: false, error: error.message };
  }
}

// ==========================================
// 5. PRIVATE CHAT SYSTEM (STRICT CONTRACT CHECK)
// ==========================================

export async function getRmConversation(connectionId: string) {
  try {
    const user = await verifyAuthUser();

    const connection = await prisma.rmConnection.findUnique({
      where: { id: connectionId },
      include: {
        contracts: {
          where: { status: "FULLY_SIGNED" },
          take: 1,
        },
        user: { select: { id: true, uid: true, name: true, email: true, avatarUrl: true } },
        rm: {
          select: {
            id: true,
            uid: true,
            name: true,
            email: true,
            avatarUrl: true,
            rmProfile: true,
          },
        },
      },
    });

    if (!connection) {
      return { success: false, error: "Connection record not found." };
    }

    const isAdmin = user.role === "ADMIN" || user.role === "SUPER_ADMIN";
    const isUser = user.id === connection.userId;
    const isRm = user.id === connection.rmId;

    if (!isAdmin && !isUser && !isRm) {
      return { success: false, error: "Unauthorized: You do not belong to this conversation." };
    }

    // STRICT CHECK: Connection must be ACTIVE and Contract must be FULLY_SIGNED
    if (connection.status !== "ACTIVE" || connection.contracts.length === 0) {
      return {
        success: false,
        requiresActiveContract: true,
        error: "Private chat is locked. Both parties must first complete and sign the ETH Investment Contract.",
      };
    }

    // Fetch conversation & messages
    let conversation = await prisma.rmConversation.findUnique({
      where: { connectionId },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!conversation) {
      conversation = await prisma.rmConversation.create({
        data: {
          connectionId,
          userId: connection.userId,
          rmId: connection.rmId,
        },
        include: { messages: true },
      });
    }

    // Mark unread messages sent by the other party as read ONLY if unread messages exist
    const hasUnread = conversation.messages.some(
      (m: any) => !m.isRead && m.senderId !== user.id
    );
    if (hasUnread) {
      await prisma.rmMessage.updateMany({
        where: {
          conversationId: conversation.id,
          senderId: { not: user.id },
          isRead: false,
        },
        data: {
          isRead: true,
          readAt: new Date(),
        },
      });
      conversation.messages.forEach((m: any) => {
        if (!m.isRead && m.senderId !== user.id) {
          m.isRead = true;
          m.readAt = new Date();
        }
      });
    }

    const otherParty = isUser
      ? {
          id: connection.rm.id,
          uid: connection.rm.uid,
          name: connection.rm.name || "Relationship Manager",
          email: connection.rm.email,
          avatarUrl: connection.rm.avatarUrl || connection.rm.rmProfile?.avatarUrl,
          role: "RM",
          designation: connection.rm.rmProfile?.designation || "Relationship Manager",
          rmCode: connection.rm.rmProfile?.rmCode || `RM-${connection.rm.uid}`,
        }
      : {
          id: connection.user.id,
          uid: connection.user.uid,
          name: connection.user.name || connection.user.email,
          email: connection.user.email,
          avatarUrl: connection.user.avatarUrl,
          role: "USER",
          designation: "Investor Client",
          rmCode: `UID: #${connection.user.uid}`,
        };

    return {
      success: true,
      conversationId: conversation.id,
      connectionId: connection.id,
      contractId: connection.contracts[0]?.id || null,
      contractNumber: connection.contracts[0]?.contractNumber || null,
      messages: conversation.messages,
      otherParty,
      currentUserId: user.id,
    };
  } catch (error: any) {
    console.error("getRmConversation error:", error);
    return { success: false, error: error.message };
  }
}

export async function sendRmMessage(data: { conversationId: string; text: string }) {
  try {
    const user = await verifyAuthUser();
    const { conversationId, text } = data;

    if (!text || !text.trim()) {
      return { success: false, error: "Message cannot be empty." };
    }

    const conversation = await prisma.rmConversation.findUnique({
      where: { id: conversationId },
      include: {
        connection: {
          include: {
            contracts: { where: { status: "FULLY_SIGNED" }, take: 1 },
          },
        },
      },
    });

    if (!conversation) {
      return { success: false, error: "Conversation not found." };
    }

    const isAdmin = user.role === "ADMIN" || user.role === "SUPER_ADMIN";
    const isUser = user.id === conversation.userId;
    const isRm = user.id === conversation.rmId;

    if (!isAdmin && !isUser && !isRm) {
      return { success: false, error: "Unauthorized to send messages in this conversation." };
    }

    // STRICT CHECK: Contract and Connection must be ACTIVE
    if (
      conversation.connection.status !== "ACTIVE" ||
      conversation.connection.contracts.length === 0
    ) {
      return {
        success: false,
        error: "Cannot send message: Active and fully signed contract required.",
      };
    }

    const message = await prisma.rmMessage.create({
      data: {
        conversationId,
        senderId: user.id,
        text: text.trim(),
      },
    });

    await prisma.rmConversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: new Date() },
    });

    // Notify recipient
    const recipientId = user.id === conversation.userId ? conversation.rmId : conversation.userId;
    await prisma.rmNotification.create({
      data: {
        userId: recipientId,
        title: `New Message from ${user.name || user.email}`,
        message: text.trim().slice(0, 100),
        type: "NEW_MESSAGE",
        linkUrl: `/rm/chat/${conversation.connectionId}`,
      },
    });

    return { success: true, message };
  } catch (error: any) {
    console.error("sendRmMessage error:", error);
    return { success: false, error: error.message };
  }
}

// ==========================================
// 6. IN-APP NOTIFICATIONS
// ==========================================

export async function getUserNotifications() {
  try {
    const session = await getSession();
    if (!session?.userId) return { success: true, notifications: [], unreadCount: 0 };

    const [notifications, unreadCount] = await Promise.all([
      prisma.rmNotification.findMany({
        where: { userId: session.userId },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      prisma.rmNotification.count({
        where: { userId: session.userId, isRead: false },
      }),
    ]);

    return { success: true, notifications, unreadCount };
  } catch (error: any) {
    return { success: false, error: error.message, notifications: [], unreadCount: 0 };
  }
}

export async function markNotificationAsRead(notificationId: string) {
  try {
    const user = await verifyAuthUser();
    await prisma.rmNotification.updateMany({
      where: { id: notificationId, userId: user.id },
      data: { isRead: true },
    });
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function markAllNotificationsAsRead() {
  try {
    const user = await verifyAuthUser();
    await prisma.rmNotification.updateMany({
      where: { userId: user.id, isRead: false },
      data: { isRead: true },
    });
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// ==========================================
// 7. CONTRACT TERMS HELPER
// ==========================================

function getStandardContractTerms(params: {
  contractNumber: string;
  rmName: string;
  rmCode: string;
  clientName: string;
  clientUid: number;
}) {
  return `
### ETHSLTD CRYPTO ASSET INVESTMENT & ADVISORY AGREEMENT
**Contract Identifier:** ${params.contractNumber}
**Version:** 1.0.0 (Immutable Digital Record)

---

#### 1. PARTIES TO THE CONTRACT
* **Party A (Platform Representative / Relationship Manager):**  
  **Name:** ${params.rmName}  
  **Designation:** Licensed Senior Relationship Manager  
  **RM License Code:** ${params.rmCode}  
  **Entity:** ETHSLTD Financial Technology Research Group Ltd.  
  **Registered Address:** 124 City Road, London, EC1V 2NX, United Kingdom  
  **Official Portal:** https://www.ethsltd.com  

* **Party B (Client / Investor):**  
  **Name / Registered Identifier:** ${params.clientName}  
  **Account UID:** #${params.clientUid}  
  **Status:** Authenticated Investor Account  

---

#### 2. LEGAL PREAMBLE & REGULATORY ACCORD
According to the legal and regulatory agreements of the **"Virtual Currency International Investment Contract Law"**, cross-border digital asset advisory conventions, and platform operational guidelines, Party A and Party B agree to enter into this legally binding investment and relationship advisory agreement.

---

#### 3. SCOPE OF SERVICES & ADVISORY
1. **Advisory Scope:** Party A shall provide non-custodial trading guidance, market insights, risk evaluation, and dedicated execution assistance on supported spot, perpetual futures, and options digital asset products.
2. **Execution Independence:** Party B retains full beneficial ownership and ultimate execution control over all wallet funds and account balances.
3. **Dedicated Private Communication:** Subject to mutual execution and verification of this agreement, Party A and Party B are granted access to a dedicated encrypted private communication channel on the ETHSLTD platform.

---

#### 4. ASSET SAFETY, DEPOSITS & WITHDRAWALS
1. All client deposits and withdrawals are processed strictly through authorized banking channels and verified distributed ledger networks (TRC20, ERC20, BEP20) in accordance with ETHSLTD AML/CTF protocols.
2. Party A will never request Party B's private keys, transaction PINs, or direct wallet transfer to personal addresses.
3. Account funds are segregated and protected by ETHSLTD cryptographic cold-storage architecture.

---

#### 5. DIGITAL ASSET VOLATILITY & RISK DISCLOSURES
1. Crypto assets and derivative contracts (Perpetual Futures & Binary Options) entail high volatility and substantial financial risk, including potential loss of principal.
2. High leverage positions are subject to automated margin maintenance and liquidation thresholds. Party B acknowledges that past trading performance does not guarantee future results.
3. Party B affirms that they possess adequate financial sophistication and risk tolerance for speculative digital asset transactions.

---

#### 6. DIGITAL SIGNATURE VALIDITY & MUTUAL CONSENT
1. This agreement requires explicit dual-party execution via cryptographic electronic signatures.
2. Party A and Party B agree that electronic drawing signatures submitted via the platform's secure signatory canvas constitute legally binding consent.
3. The contract is executed and becomes legally active only upon completion of verified signatures by both Party A and Party B.
4. Neither party may unilaterally alter the terms once signed. Any modifications require an amended agreement and renewed mutual consent.

---

#### 7. GOVERNING LAW & DISPUTE RESOLUTION
This agreement is governed by the laws of England and Wales and international private digital asset regulatory conventions. Any disputes arising hereunder shall be subject to amicable settlement, failing which they shall be submitted to the London Court of International Arbitration (LCIA).
  `.trim();
}

// ==========================================
// 8. USER-TO-RM RATING & REVIEW SYSTEM
// ==========================================

async function recalculateRmRatingStats(rmId: string) {
  try {
    const approvedReviews = await prisma.rmReview.findMany({
      where: { rmId, status: "APPROVED" },
      select: { rating: true },
    });
    const totalRatings = approvedReviews.length;
    const avgRating =
      totalRatings > 0
        ? Math.round((approvedReviews.reduce((sum: number, r: any) => sum + (r.rating || 0), 0) / totalRatings) * 10) / 10
        : 0;

    await (prisma.rmProfile as any).updateMany({
      where: { userId: rmId },
      data: {
        rating: avgRating,
        totalRatings,
      },
    });

    safeRevalidate("/relationship-managers");
    safeRevalidate("/admin/rm");
  } catch (err) {
    console.error("recalculateRmRatingStats error:", err);
  }
}

export async function submitRmReview(rmId: string, rating: number, comment?: string) {
  try {
    const user = await verifyAuthUser();

    if (user.id === rmId) {
      return { success: false, error: "You cannot rate your own Relationship Manager account." };
    }

    // Verify target RM exists and has RM role
    const rmUser = await prisma.user.findFirst({
      where: { id: rmId, role: "RM" },
      include: { rmProfile: true },
    });

    if (!rmUser) {
      return { success: false, error: "Relationship Manager not found or inactive." };
    }

    // Business rule: User can only rate an RM with whom they have an active or accepted connection
    const connection = await prisma.rmConnection.findFirst({
      where: {
        userId: user.id,
        rmId,
        status: { in: ["ACTIVE", "ACCEPTED", "CONTRACT_PENDING"] },
      },
    });

    if (!connection) {
      return {
        success: false,
        error: "You can only rate a Relationship Manager who is assigned or actively connected with you.",
      };
    }

    // Validate rating
    const cleanRating = Math.round(Number(rating));
    if (isNaN(cleanRating) || cleanRating < 1 || cleanRating > 5) {
      return { success: false, error: "Rating score must be between 1 and 5 stars." };
    }

    const cleanComment = comment?.trim().slice(0, 1000) || null;

    // Upsert review (enforces single review per user-RM, supports updating)
    const review = await prisma.rmReview.upsert({
      where: {
        userId_rmId: {
          userId: user.id,
          rmId,
        },
      },
      update: {
        rating: cleanRating,
        comment: cleanComment,
        status: "APPROVED",
        updatedAt: new Date(),
      },
      create: {
        userId: user.id,
        rmId,
        rating: cleanRating,
        comment: cleanComment,
        status: "APPROVED",
      },
    });

    // Automatically recalculate RM average rating and total counts
    await recalculateRmRatingStats(rmId);

    return {
      success: true,
      message: "Thank you! Your rating and review have been saved successfully.",
      review,
    };
  } catch (error: any) {
    console.error("submitRmReview error:", error);
    return { success: false, error: error.message || "Failed to submit rating." };
  }
}

export async function getUserRmReview(rmId: string) {
  try {
    const user = await verifyAuthUser();
    const review = await prisma.rmReview.findUnique({
      where: {
        userId_rmId: {
          userId: user.id,
          rmId,
        },
      },
    });

    return { success: true, review };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function getRmReviews(rmId: string) {
  try {
    const reviews = await prisma.rmReview.findMany({
      where: { rmId, status: "APPROVED" },
      include: {
        user: {
          select: {
            id: true,
            uid: true,
            name: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    const formatted = reviews.map((r) => ({
      id: r.id,
      rating: r.rating,
      comment: r.comment,
      createdAt: r.createdAt,
      user: {
        uid: r.user.uid,
        name: r.user.name || `Investor #${r.user.uid}`,
        avatarUrl: r.user.avatarUrl,
      },
    }));

    return { success: true, reviews: formatted };
  } catch (error: any) {
    console.error("getRmReviews error:", error);
    return { success: false, error: error.message, reviews: [] };
  }
}

export async function deleteUserRmReview(rmId: string) {
  try {
    const user = await verifyAuthUser();

    await prisma.rmReview.deleteMany({
      where: {
        userId: user.id,
        rmId,
      },
    });

    // Recalculate stats
    await recalculateRmRatingStats(rmId);

    return { success: true, message: "Your review has been removed." };
  } catch (error: any) {
    console.error("deleteUserRmReview error:", error);
    return { success: false, error: error.message || "Failed to delete review." };
  }
}
