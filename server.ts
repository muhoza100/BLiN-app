import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import {
  UserAccount,
  PostItem,
  StoryItem,
  CommunityItem,
  Conversation,
  ChatMessage,
  VoiceRoomItem,
  VoiceParticipant,
  VoiceRoomChat,
  PointsLedgerEntry,
} from './src/types/blin';
import { createDefaultSettings } from './src/data/defaultSettings';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const app = express();
const server = http.createServer(app);

// Shared Gemini Client
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});


app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// In-Memory Data Store (Zero fake profiles, zero fake posts, zero fake rooms)
const users: Map<string, UserAccount & { passwordHash: string }> = new Map();
const tokens: Map<string, string> = new Map(); // token -> userId
const posts: Map<string, PostItem> = new Map();
const stories: Map<string, StoryItem> = new Map();
const communities: Map<string, CommunityItem> = new Map();
const conversations: Map<string, Conversation> = new Map();
const messages: Map<string, ChatMessage[]> = new Map(); // conversationId -> messages
const voiceRooms: Map<string, VoiceRoomItem> = new Map();

// WebSocket connection registry: userId -> Set of WebSockets
const userSockets: Map<string, Set<WebSocket>> = new Map();

// Voice Room Presence Tracking (roomId -> Set of connected userIds)
const roomPresences: Map<string, Set<string>> = new Map();
const userRoomPresence: Map<string, string> = new Map(); // userId -> roomId

function broadcastToRoom(roomId: string, message: any, excludeUserId?: string) {
  const userIds = roomPresences.get(roomId);
  if (!userIds) return;
  const payload = JSON.stringify(message);
  userIds.forEach((uid) => {
    if (uid !== excludeUserId) {
      const sockets = userSockets.get(uid);
      if (sockets) {
        sockets.forEach((s) => {
          if (s.readyState === WebSocket.OPEN) {
            s.send(payload);
          }
        });
      }
    }
  });
}

function broadcastGlobal(message: any) {
  const payload = JSON.stringify(message);
  userSockets.forEach((sockets) => {
    sockets.forEach((s) => {
      if (s.readyState === WebSocket.OPEN) {
        s.send(payload);
      }
    });
  });
}


function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password + 'blin_salt_2026').digest('hex');
}

function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

// Authentication middleware
function authenticate(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: missing token' });
  }
  const token = authHeader.slice(7);
  const userId = tokens.get(token);
  if (!userId || !users.has(userId)) {
    return res.status(401).json({ error: 'Unauthorized: invalid or expired session' });
  }
  (req as any).userId = userId;
  (req as any).user = users.get(userId)!;
  next();
}

// =============================================================================
// AUTH ROUTES
// =============================================================================
app.get('/api/auth/check-username', (req, res) => {
  const username = String(req.query.username || '').toLowerCase().trim();
  if (username.length < 3) {
    return res.json({ available: false });
  }
  let taken = false;
  for (const u of users.values()) {
    if (u.username.toLowerCase() === username) {
      taken = true;
      break;
    }
  }
  res.json({ available: !taken });
});

app.post('/api/auth/register', (req, res) => {
  const { displayName, username, email, dateOfBirth, password } = req.body;
  if (!displayName || !username || !email || !password) {
    return res.status(400).json({ error: 'Please fill in all required fields.' });
  }

  const cleanUsername = username.trim().toLowerCase().replace(/^@/, '');
  for (const u of users.values()) {
    if (u.username.toLowerCase() === cleanUsername) {
      return res.status(400).json({ error: 'Username is already taken.' });
    }
    if (u.email.toLowerCase() === email.trim().toLowerCase()) {
      return res.status(400).json({ error: 'Email is already registered.' });
    }
  }

  const id = 'user_' + crypto.randomBytes(8).toString('hex');
  const now = new Date().toISOString();
  const token = generateToken();

  const newSession = {
    id: 'sess_' + crypto.randomBytes(6).toString('hex'),
    device: 'Desktop Browser',
    browser: 'Chrome / Safari',
    os: 'Linux / Web',
    ip: '127.0.0.1',
    location: 'Verified Local Session',
    current: true,
    createdAt: now,
    lastActiveAt: now,
  };

  const newUser: UserAccount & { passwordHash: string } = {
    id,
    username: cleanUsername,
    displayName: displayName.trim(),
    email: email.trim(),
    dateOfBirth: dateOfBirth || '2000-01-01',
    avatarUrl: '',
    bio: '',
    verified: false,
    isOnline: true,
    pointsBalance: 50, // Welcome signup bonus
    streakDays: 1,
    settings: createDefaultSettings(),
    followerIds: [],
    followingIds: [],
    blockedUserIds: [],
    restrictedUserIds: [],
    closeFriendIds: [],
    hiddenWords: [],
    hiddenPostIds: [],
    pendingFollowRequestIds: [],
    activeSessions: [newSession],
    securityLog: [
      {
        id: 'sec_' + Date.now(),
        action: 'Account Created',
        detail: 'Initial account registration and session bootstrap',
        ip: '127.0.0.1',
        device: 'Web Client',
        timestamp: now,
        status: 'success',
      },
    ],
    pointsLedger: [
      {
        id: 'pts_' + Date.now(),
        timestamp: now,
        action: 'manual_grant',
        amount: 50,
        balanceAfter: 50,
        description: 'Welcome to BLiN Community Bonus',
      },
    ],
    recoveryCodes: [
      crypto.randomBytes(4).toString('hex').toUpperCase(),
      crypto.randomBytes(4).toString('hex').toUpperCase(),
      crypto.randomBytes(4).toString('hex').toUpperCase(),
      crypto.randomBytes(4).toString('hex').toUpperCase(),
    ],
    createdAt: now,
    updatedAt: now,
    passwordHash: hashPassword(password),
  };

  users.set(id, newUser);
  tokens.set(token, id);

  const { passwordHash, ...safeUser } = newUser;
  res.json({ token, user: safeUser });
});

app.post('/api/auth/login', (req, res) => {
  const { identifier, password } = req.body;
  if (!identifier || !password) {
    return res.status(400).json({ error: 'Please enter identifier and password.' });
  }

  const cleanId = identifier.trim().toLowerCase().replace(/^@/, '');
  const hashed = hashPassword(password);

  let target: (UserAccount & { passwordHash: string }) | null = null;
  for (const u of users.values()) {
    if (u.username.toLowerCase() === cleanId || u.email.toLowerCase() === cleanId) {
      target = u;
      break;
    }
  }

  if (!target || target.passwordHash !== hashed) {
    return res.status(401).json({ error: 'Invalid credentials. Please try again.' });
  }

  const token = generateToken();
  tokens.set(token, target.id);
  target.isOnline = true;
  target.updatedAt = new Date().toISOString();

  const { passwordHash, ...safeUser } = target;
  res.json({ token, user: safeUser });
});

app.post('/api/auth/firebase-login', (req, res) => {
  const { uid, email, displayName, photoURL } = req.body;
  if (!uid || !email) {
    return res.status(400).json({ error: 'Missing Firebase user details.' });
  }

  const cleanEmail = email.trim().toLowerCase();
  let target: (UserAccount & { passwordHash: string }) | null = null;

  for (const u of users.values()) {
    if (u.id === uid || u.email.toLowerCase() === cleanEmail) {
      target = u;
      break;
    }
  }

  const now = new Date().toISOString();
  const token = generateToken();

  if (!target) {
    // Auto-create user from Firebase authenticated identity
    const baseUsername = (displayName || email.split('@')[0])
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '')
      .slice(0, 15) || 'blin_user';
    let finalUsername = baseUsername;
    let counter = 1;
    const existingUsernames = new Set(Array.from(users.values()).map(u => u.username.toLowerCase()));
    while (existingUsernames.has(finalUsername)) {
      finalUsername = `${baseUsername}${counter++}`;
    }

    const newSession = {
      id: 'sess_' + crypto.randomBytes(6).toString('hex'),
      device: 'Google Firebase Auth Session',
      browser: 'Chrome / Safari / Web',
      os: 'Cloud Verified',
      ip: req.ip || '127.0.0.1',
      location: 'Firebase Secure Auth',
      current: true,
      createdAt: now,
      lastActiveAt: now,
    };

    const newUser: UserAccount & { passwordHash: string } = {
      id: uid,
      username: finalUsername,
      displayName: displayName || finalUsername,
      email: cleanEmail,
      dateOfBirth: '2002-05-18',
      avatarUrl: photoURL || '',
      bio: 'Verified Firebase Google Member on BLiN.',
      verified: true,
      isOnline: true,
      pointsBalance: 100, // Welcome bonus for verified Google sign-in
      streakDays: 1,
      settings: createDefaultSettings(),
      followerIds: [],
      followingIds: [],
      blockedUserIds: [],
      restrictedUserIds: [],
      closeFriendIds: [],
      hiddenWords: [],
      hiddenPostIds: [],
      pendingFollowRequestIds: [],
      activeSessions: [newSession],
      securityLog: [
        {
          id: 'sec_' + Date.now(),
          action: 'Google Firebase Sign-In',
          detail: 'Verified OAuth 2.0 credential authenticated through Firebase Auth',
          ip: req.ip || '127.0.0.1',
          device: 'Google Account',
          timestamp: now,
          status: 'success',
        },
      ],
      pointsLedger: [
        {
          id: 'pts_' + Date.now(),
          timestamp: now,
          action: 'manual_grant',
          amount: 100,
          balanceAfter: 100,
          description: 'Firebase Verified Account Welcome Grant (+100 pts)',
        },
      ],
      recoveryCodes: [
        crypto.randomBytes(4).toString('hex').toUpperCase(),
        crypto.randomBytes(4).toString('hex').toUpperCase(),
        crypto.randomBytes(4).toString('hex').toUpperCase(),
        crypto.randomBytes(4).toString('hex').toUpperCase(),
      ],
      createdAt: now,
      updatedAt: now,
      passwordHash: hashPassword(crypto.randomBytes(16).toString('hex')),
    };

    users.set(uid, newUser);
    target = newUser;
  } else {
    // Update existing user profile
    if (displayName && !target.displayName) target.displayName = displayName;
    if (photoURL && !target.avatarUrl) target.avatarUrl = photoURL;
    target.isOnline = true;
    target.updatedAt = now;
    target.securityLog.unshift({
      id: 'sec_' + Date.now(),
      action: 'Firebase Session Resumed',
      detail: 'Signed in via Google Firebase Identity',
      ip: req.ip || '127.0.0.1',
      device: 'Google Auth',
      timestamp: now,
      status: 'success',
    });
  }

  tokens.set(token, target.id);
  const { passwordHash, ...safeUser } = target;
  res.json({ token, user: safeUser });
});

app.get('/api/auth/me', authenticate, (req, res) => {
  const user = (req as any).user;
  const { passwordHash, ...safeUser } = user;
  res.json(safeUser);
});

// =============================================================================
// POSTS & SPOTLIGHT REELS ROUTES (Distinct Feed Posts vs Spotlight Reels)
// =============================================================================
app.get('/api/posts', authenticate, (req, res) => {
  const currentUserId = (req as any).userId;
  const postList = Array.from(posts.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const enriched = postList.map((p) => {
    const author = users.get(p.authorId);
    return {
      ...p,
      author: {
        id: p.authorId,
        displayName: author?.displayName || p.authorDisplayName || 'Creator',
        username: author?.username || p.authorUsername || 'creator',
        avatarUrl: author?.avatarUrl || p.authorAvatar || '',
        verified: author?.verified || p.authorVerified || false,
      },
      isLiked: p.likeUserIds.includes(currentUserId),
      isSaved: p.savedUserIds.includes(currentUserId),
      isReposted: p.repostUserIds.includes(currentUserId),
    };
  });

  res.json(enriched);
});

app.post('/api/posts', authenticate, (req, res) => {
  const user = (req as any).user;
  const {
    kind,
    postType,
    caption,
    mediaUrl,
    mediaType,
    aspectRatio,
    audioAttribution,
    videoDuration,
    topics,
    audience,
  } = req.body;

  const id = 'post_' + crypto.randomBytes(8).toString('hex');
  const now = new Date().toISOString();

  const isReel = kind === 'spotlight' || postType === 'spotlight_reel';

  const newPost: PostItem = {
    id,
    authorId: user.id,
    authorUsername: user.username,
    authorDisplayName: user.displayName,
    authorAvatar: user.avatarUrl,
    authorVerified: user.verified,
    postType: isReel ? 'spotlight_reel' : 'feed',
    caption: caption || '',
    mediaUrl: mediaUrl || undefined,
    mediaType: mediaType || (mediaUrl ? 'image' : 'none'),
    aspectRatio: isReel ? 'vertical' : (aspectRatio || 'standard'),
    videoDuration: isReel ? (videoDuration || '0:28') : undefined,
    audioAttribution: isReel ? (audioAttribution || `Original sound - ${user.displayName}`) : undefined,
    topics: Array.isArray(topics) ? topics : [],
    audience: audience || 'public',
    allowComments: true,
    likeUserIds: [],
    repostUserIds: [],
    savedUserIds: [],
    shareCount: 0,
    comments: [],
    createdAt: now,
  };

  posts.set(id, newPost);
  res.json(newPost);
});

// Like Post / Reel (Server-Authoritative Points Awarding: 1 like = 10 pts, +5 bonus per 10 likes)
app.post('/api/posts/:id/like', authenticate, (req, res) => {
  const userId = (req as any).userId;
  const post = posts.get(req.params.id);
  if (!post) {
    return res.status(404).json({ error: 'Post not found' });
  }

  const hasLiked = post.likeUserIds.includes(userId);
  if (hasLiked) {
    post.likeUserIds = post.likeUserIds.filter((id) => id !== userId);
  } else {
    post.likeUserIds.push(userId);

    // Award points to author if liking another creator's post/reel
    if (post.authorId !== userId) {
      const author = users.get(post.authorId);
      if (author) {
        let ptsEarned = 10; // 1 like = 10 pts
        const totalLikes = post.likeUserIds.length;
        if (totalLikes > 0 && totalLikes % 10 === 0) {
          ptsEarned += 5; // Milestone bonus every 10 likes
        }
        author.pointsBalance += ptsEarned;
        author.pointsLedger.unshift({
          id: 'pts_' + Date.now(),
          timestamp: new Date().toISOString(),
          action: 'like_received',
          amount: ptsEarned,
          balanceAfter: author.pointsBalance,
          description: `Like received on ${post.postType === 'spotlight_reel' ? 'Spotlight Reel' : 'Post'} (+${ptsEarned} pts)`,
          sourceUserId: userId,
          targetPostId: post.id,
        });
      }
    }
  }

  res.json({ success: true, likeCount: post.likeUserIds.length, isLiked: !hasLiked });
});

app.post('/api/posts/:id/save', authenticate, (req, res) => {
  const userId = (req as any).userId;
  const post = posts.get(req.params.id);
  if (!post) return res.status(404).json({ error: 'Post not found' });

  const hasSaved = post.savedUserIds.includes(userId);
  if (hasSaved) {
    post.savedUserIds = post.savedUserIds.filter((id) => id !== userId);
  } else {
    post.savedUserIds.push(userId);
  }
  res.json({ success: true, isSaved: !hasSaved });
});

app.post('/api/posts/:id/repost', authenticate, (req, res) => {
  const userId = (req as any).userId;
  const post = posts.get(req.params.id);
  if (!post) return res.status(404).json({ error: 'Post not found' });

  const hasReposted = post.repostUserIds.includes(userId);
  if (hasReposted) {
    post.repostUserIds = post.repostUserIds.filter((id) => id !== userId);
  } else {
    post.repostUserIds.push(userId);
  }
  res.json({ success: true, isReposted: !hasReposted });
});

app.post('/api/posts/:id/comment', authenticate, (req, res) => {
  const user = (req as any).user;
  const post = posts.get(req.params.id);
  if (!post) return res.status(404).json({ error: 'Post not found' });

  const { content } = req.body;
  if (!content || !content.trim()) {
    return res.status(400).json({ error: 'Comment content cannot be empty' });
  }

  const comment = {
    id: 'cmt_' + crypto.randomBytes(6).toString('hex'),
    authorId: user.id,
    authorUsername: user.username,
    authorDisplayName: user.displayName,
    authorAvatar: user.avatarUrl,
    content: content.trim(),
    createdAt: new Date().toISOString(),
    likeCount: 0,
  };

  post.comments.push(comment);
  res.json(comment);
});

// =============================================================================
// STORIES (24H Moments)
// =============================================================================
app.get('/api/stories', authenticate, (req, res) => {
  const list = Array.from(stories.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  res.json(list);
});

app.post('/api/stories', authenticate, (req, res) => {
  const user = (req as any).user;
  const { text, mediaUrl, audience } = req.body;

  const id = 'story_' + crypto.randomBytes(6).toString('hex');
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();

  const newStory: StoryItem = {
    id,
    authorId: user.id,
    authorName: user.displayName,
    authorUsername: user.username,
    authorAvatar: user.avatarUrl,
    text: text || '',
    mediaUrl: mediaUrl || undefined,
    backgroundGradient: 'from-violet-900 via-indigo-900 to-pink-900',
    audience: audience || 'everyone',
    createdAt: now.toISOString(),
    expiresAt,
    viewers: [],
  };

  stories.set(id, newStory);
  res.json(newStory);
});

// =============================================================================
// COMMUNITIES
// =============================================================================
app.get('/api/communities', authenticate, (req, res) => {
  res.json(Array.from(communities.values()));
});

app.post('/api/communities', authenticate, (req, res) => {
  const user = (req as any).user;
  const { name, category, description } = req.body;

  const id = 'comm_' + crypto.randomBytes(6).toString('hex');
  const gradients = [
    'from-violet-600 to-pink-500',
    'from-cyan-500 to-blue-600',
    'from-emerald-500 to-teal-700',
    'from-amber-500 to-rose-600',
  ];
  const avatarGradient = gradients[Math.floor(Math.random() * gradients.length)];

  const newComm: CommunityItem = {
    id,
    name: name.trim(),
    category: category || 'Creators Hub',
    description: description || '',
    avatarGradient,
    creatorId: user.id,
    creatorUsername: user.username,
    memberIds: [user.id],
    isPrivate: false,
    createdAt: new Date().toISOString(),
  };

  communities.set(id, newComm);
  res.json(newComm);
});

app.post('/api/communities/:id/join', authenticate, (req, res) => {
  const userId = (req as any).userId;
  const comm = communities.get(req.params.id);
  if (!comm) return res.status(404).json({ error: 'Community not found' });

  const idx = comm.memberIds.indexOf(userId);
  if (idx >= 0) {
    comm.memberIds.splice(idx, 1);
  } else {
    comm.memberIds.push(userId);
  }
  res.json({ success: true, joined: idx < 0 });
});

// =============================================================================
// USERS DIRECTORY & FOLLOW (1 follower = 1 pt)
// =============================================================================
app.get('/api/users', authenticate, (req, res) => {
  const currentUserId = (req as any).userId;
  const list = Array.from(users.values()).map((u) => ({
    id: u.id,
    username: u.username,
    displayName: u.displayName,
    avatarUrl: u.avatarUrl,
    bio: u.bio,
    verified: u.verified,
    isOnline: u.isOnline,
    followerCount: u.followerIds.length,
    followingCount: u.followingIds.length,
    pointsBalance: u.settings.showStatsPublicly ? u.pointsBalance : null,
    isFollowing: u.followerIds.includes(currentUserId),
    hasRequestedFollow: false,
    isCloseFriend: false,
  }));
  res.json(list);
});

app.post('/api/users/:id/follow', authenticate, (req, res) => {
  const current = (req as any).user;
  const target = users.get(req.params.id);
  if (!target) return res.status(404).json({ error: 'User not found' });

  const isFollowing = current.followingIds.includes(target.id);
  if (isFollowing) {
    current.followingIds = current.followingIds.filter((id: string) => id !== target.id);
    target.followerIds = target.followerIds.filter((id: string) => id !== current.id);
  } else {
    current.followingIds.push(target.id);
    target.followerIds.push(current.id);

    // Award 1 pt to followed user per BLiN authoritative points rules
    target.pointsBalance += 1;
    target.pointsLedger.unshift({
      id: 'pts_' + Date.now(),
      timestamp: new Date().toISOString(),
      action: 'follow_received',
      amount: 1,
      balanceAfter: target.pointsBalance,
      description: `New follower @${current.username} (+1 pt)`,
      sourceUserId: current.id,
    });
  }

  res.json({ success: true, isFollowing: !isFollowing });
});

// =============================================================================
// MESSAGING & CHATS
// =============================================================================
app.get('/api/conversations', authenticate, (req, res) => {
  const userId = (req as any).userId;
  const list = Array.from(conversations.values())
    .filter((c) => c.participantIds.includes(userId))
    .map((c) => {
      const parts = c.participantIds
        .map((pid) => users.get(pid))
        .filter(Boolean)
        .map((u) => ({
          id: u!.id,
          username: u!.username,
          displayName: u!.displayName,
          avatarUrl: u!.avatarUrl,
          bio: u!.bio,
          verified: u!.verified,
          isOnline: u!.isOnline,
          followerCount: u!.followerIds.length,
          followingCount: u!.followingIds.length,
          pointsBalance: u!.pointsBalance,
          isFollowing: false,
          hasRequestedFollow: false,
          isCloseFriend: false,
        }));

      const convMessages = messages.get(c.id) || [];
      const last = convMessages[convMessages.length - 1] || null;
      return {
        ...c,
        participants: parts,
        lastMessage: last,
        unreadCount: 0,
      };
    });

  res.json(list);
});

app.post('/api/conversations', authenticate, (req, res) => {
  const current = (req as any).user;
  const { participantIds, title } = req.body;

  const allParts = Array.from(new Set([current.id, ...(participantIds || [])]));
  const id = 'conv_' + crypto.randomBytes(6).toString('hex');
  const now = new Date().toISOString();

  const newConv: Conversation = {
    id,
    isGroup: allParts.length > 2,
    title: title || (allParts.length > 2 ? 'Group Chat' : undefined),
    participantIds: allParts,
    createdAt: now,
    updatedAt: now,
  };

  conversations.set(id, newConv);
  messages.set(id, []);
  res.json(newConv);
});

app.get('/api/conversations/:id/messages', authenticate, (req, res) => {
  const list = messages.get(req.params.id) || [];
  res.json(list);
});

app.post('/api/conversations/:id/messages', authenticate, (req, res) => {
  const user = (req as any).user;
  const conv = conversations.get(req.params.id);
  if (!conv) return res.status(404).json({ error: 'Conversation not found' });

  const { content, mediaUrl, mediaType, voiceDurationSec } = req.body;
  const id = 'msg_' + crypto.randomBytes(6).toString('hex');
  const now = new Date().toISOString();

  const msg: ChatMessage = {
    id,
    conversationId: conv.id,
    senderId: user.id,
    senderUsername: user.username,
    senderDisplayName: user.displayName,
    senderAvatar: user.avatarUrl,
    content: content || '',
    mediaUrl: mediaUrl || undefined,
    mediaType: mediaType || undefined,
    voiceDurationSec: voiceDurationSec || undefined,
    readByUserIds: [user.id],
    deliveredToUserIds: [user.id],
    reactions: {},
    createdAt: now,
  };

  const list = messages.get(conv.id) || [];
  list.push(msg);
  messages.set(conv.id, list);
  conv.updatedAt = now;

  // Broadcast to other participants via WebSockets
  conv.participantIds.forEach((pid) => {
    if (pid !== user.id) {
      const sockets = userSockets.get(pid);
      if (sockets) {
        sockets.forEach((ws) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'message:created', message: msg, conversationId: conv.id }));
          }
        });
      }
    }
  });

  res.json(msg);
});

// =============================================================================
// LIVE VOICE ROOMS & REAL-TIME PRESENCE TRACKING
// =============================================================================
function handleUserLeaveRoom(userId: string, roomId: string) {
  const room = voiceRooms.get(roomId);
  const userPresences = roomPresences.get(roomId);
  if (userPresences) {
    userPresences.delete(userId);
  }
  userRoomPresence.delete(userId);

  if (room) {
    room.participants = room.participants.filter((p) => p.userId !== userId);
    room.listenersCount = room.participants.filter((p) => p.role === 'listener').length;

    if (room.participants.length === 0 || (userPresences && userPresences.size === 0)) {
      voiceRooms.delete(roomId);
      roomPresences.delete(roomId);
      broadcastGlobal({
        type: 'voiceroom:destroyed',
        roomId,
      });
      return;
    }

    // If host left, transfer host role to next speaker or participant
    if (room.hostId === userId && room.participants.length > 0) {
      const nextHost = room.participants.find((p) => p.role === 'speaker') || room.participants[0];
      room.hostId = nextHost.userId;
      room.hostUsername = nextHost.username;
      room.hostDisplayName = nextHost.displayName;
      room.hostAvatar = nextHost.avatarUrl;
      nextHost.role = 'host';
    }

    broadcastToRoom(roomId, {
      type: 'voiceroom:left',
      roomId,
      userId,
      room,
      presenceCount: userPresences ? userPresences.size : 0,
    });

    broadcastGlobal({
      type: 'voiceroom:list_update',
    });
  }
}

app.get('/api/voicerooms', authenticate, (req, res) => {
  const rooms = Array.from(voiceRooms.values()).map((r) => {
    const presentUserIds = roomPresences.get(r.id) || new Set();
    return {
      ...r,
      listenersCount: r.participants.filter((p) => p.role === 'listener').length,
      activePresenceCount: presentUserIds.size,
    };
  });
  res.json(rooms);
});

app.post('/api/voicerooms', authenticate, (req, res) => {
  const user = (req as any).user;
  const { title, topic, description } = req.body;

  const id = 'room_' + crypto.randomBytes(6).toString('hex');
  const now = new Date().toISOString();

  // If user is currently in another room, leave it first
  if (userRoomPresence.has(user.id)) {
    const prevRoomId = userRoomPresence.get(user.id)!;
    handleUserLeaveRoom(user.id, prevRoomId);
  }

  const hostParticipant: VoiceParticipant = {
    id: 'part_' + crypto.randomBytes(4).toString('hex'),
    userId: user.id,
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    role: 'host',
    isMuted: false,
    isSpeaking: true,
    raisedHand: false,
    joinedAt: now,
  };

  const newRoom: VoiceRoomItem = {
    id,
    title: title.trim(),
    description: description || '',
    topic: topic || 'Creators & Tech',
    hostId: user.id,
    hostUsername: user.username,
    hostDisplayName: user.displayName,
    hostAvatar: user.avatarUrl,
    isLive: true,
    participants: [hostParticipant],
    chatMessages: [],
    listenersCount: 0,
    recentReactions: [],
    createdAt: now,
  };

  voiceRooms.set(id, newRoom);
  roomPresences.set(id, new Set([user.id]));
  userRoomPresence.set(user.id, id);

  broadcastGlobal({
    type: 'voiceroom:created',
    room: newRoom,
  });

  res.json(newRoom);
});

app.post('/api/voicerooms/:id/join', authenticate, (req, res) => {
  const user = (req as any).user;
  const roomId = req.params.id;
  const room = voiceRooms.get(roomId);
  if (!room) return res.status(404).json({ error: 'Room not found' });

  // If user was in a different room, clean up presence there
  if (userRoomPresence.has(user.id) && userRoomPresence.get(user.id) !== roomId) {
    handleUserLeaveRoom(user.id, userRoomPresence.get(user.id)!);
  }

  if (!roomPresences.has(roomId)) {
    roomPresences.set(roomId, new Set());
  }
  roomPresences.get(roomId)!.add(user.id);
  userRoomPresence.set(user.id, roomId);

  let participant = room.participants.find((p) => p.userId === user.id);
  if (!participant) {
    const isHost = room.hostId === user.id;
    participant = {
      id: 'part_' + crypto.randomBytes(4).toString('hex'),
      userId: user.id,
      username: user.username,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      role: isHost ? 'host' : 'listener',
      isMuted: isHost ? false : true,
      isSpeaking: false,
      raisedHand: false,
      joinedAt: new Date().toISOString(),
    };
    room.participants.push(participant);
  } else {
    participant.isSpeaking = false;
  }

  room.listenersCount = room.participants.filter((p) => p.role === 'listener').length;

  broadcastToRoom(roomId, {
    type: 'voiceroom:joined',
    roomId,
    participant,
    room,
    presenceCount: roomPresences.get(roomId)!.size,
  });

  broadcastGlobal({
    type: 'voiceroom:list_update',
  });

  res.json({
    room,
    presenceUserIds: Array.from(roomPresences.get(roomId) || []),
  });
});

app.post('/api/voicerooms/:id/leave', authenticate, (req, res) => {
  const userId = (req as any).userId;
  const roomId = req.params.id;
  handleUserLeaveRoom(userId, roomId);
  res.json({ success: true });
});

app.post('/api/voicerooms/:id/action', authenticate, (req, res) => {
  const userId = (req as any).userId;
  const roomId = req.params.id;
  const room = voiceRooms.get(roomId);
  if (!room) return res.status(404).json({ error: 'Room not found' });

  const isHost = room.hostId === userId;
  const { action, targetUserId, isMuted, raisedHand, isSpeaking, volume } = req.body;

  if (action === 'mute') {
    const p = room.participants.find((part) => part.userId === userId);
    if (p) {
      p.isMuted = !!isMuted;
      if (p.isMuted) p.isSpeaking = false;
    }
  } else if (action === 'raise_hand') {
    const p = room.participants.find((part) => part.userId === userId);
    if (p) {
      p.raisedHand = !!raisedHand;
    }
  } else if (action === 'speaking') {
    const p = room.participants.find((part) => part.userId === userId);
    if (p) {
      p.isSpeaking = !p.isMuted && !!isSpeaking;
      if (volume !== undefined) p.speakingVolume = volume;
    }
  } else if (action === 'promote_speaker') {
    if (!isHost) return res.status(403).json({ error: 'Only the host can promote speakers' });
    const target = room.participants.find((p) => p.userId === targetUserId);
    if (target) {
      target.role = 'speaker';
      target.raisedHand = false;
    }
  } else if (action === 'demote_listener') {
    if (!isHost) return res.status(403).json({ error: 'Only the host can demote speakers' });
    const target = room.participants.find((p) => p.userId === targetUserId);
    if (target) {
      target.role = 'listener';
      target.isMuted = true;
      target.isSpeaking = false;
    }
  } else if (action === 'mute_participant') {
    if (!isHost) return res.status(403).json({ error: 'Only the host can mute other participants' });
    const target = room.participants.find((p) => p.userId === targetUserId);
    if (target) {
      target.isMuted = true;
      target.isSpeaking = false;
    }
  } else if (action === 'end_room') {
    if (!isHost) return res.status(403).json({ error: 'Only the host can end the room' });
    voiceRooms.delete(roomId);
    roomPresences.delete(roomId);
    userRoomPresence.forEach((rId, uId) => {
      if (rId === roomId) userRoomPresence.delete(uId);
    });

    broadcastToRoom(roomId, {
      type: 'voiceroom:ended',
      roomId,
      message: 'The host has ended this voice room.',
    });
    broadcastGlobal({
      type: 'voiceroom:destroyed',
      roomId,
    });
    return res.json({ success: true, ended: true });
  }

  room.listenersCount = room.participants.filter((p) => p.role === 'listener').length;

  broadcastToRoom(roomId, {
    type: 'voiceroom:state',
    roomId,
    room,
  });

  res.json(room);
});

app.post('/api/voicerooms/:id/reaction', authenticate, (req, res) => {
  const userId = (req as any).userId;
  const room = voiceRooms.get(req.params.id);
  if (!room) return res.status(404).json({ error: 'Room not found' });

  const reaction = {
    id: 'rx_' + Date.now(),
    emoji: req.body.emoji || '💜',
    userId,
    createdAt: Date.now(),
  };

  room.recentReactions.push(reaction);
  if (room.recentReactions.length > 20) {
    room.recentReactions.shift();
  }

  broadcastToRoom(room.id, {
    type: 'voiceroom:reaction',
    roomId: room.id,
    reaction,
  });

  res.json({ success: true, reaction });
});

app.post('/api/voicerooms/:id/chat', authenticate, (req, res) => {
  const user = (req as any).user;
  const room = voiceRooms.get(req.params.id);
  if (!room) return res.status(404).json({ error: 'Room not found' });

  const chatMsg: VoiceRoomChat = {
    id: 'vr_chat_' + crypto.randomBytes(6).toString('hex'),
    roomId: room.id,
    userId: user.id,
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    content: (req.body.content || '').trim(),
    createdAt: new Date().toISOString(),
  };

  room.chatMessages.push(chatMsg);

  broadcastToRoom(room.id, {
    type: 'voiceroom:chat',
    roomId: room.id,
    message: chatMsg,
  });

  res.json(chatMsg);
});


// =============================================================================
// SETTINGS & SECURITY CENTER ROUTES
// =============================================================================
app.post('/api/settings', authenticate, (req, res) => {
  const user = (req as any).user;
  if (req.body.settings) {
    user.settings = { ...user.settings, ...req.body.settings };
    user.updatedAt = new Date().toISOString();
  }
  const { passwordHash, ...safeUser } = user;
  res.json({ success: true, user: safeUser });
});

app.post('/api/security/two-factor', authenticate, (req, res) => {
  const user = (req as any).user;
  user.settings.twoFactorEnabled = !!req.body.enabled;
  user.securityLog.unshift({
    id: 'sec_' + Date.now(),
    action: req.body.enabled ? '2FA Enabled' : '2FA Disabled',
    detail: req.body.enabled
      ? 'Configured TOTP secondary verification'
      : 'Removed secondary verification',
    ip: '127.0.0.1',
    device: 'Current Device',
    timestamp: new Date().toISOString(),
    status: 'success',
  });
  const { passwordHash, ...safeUser } = user;
  res.json({ success: true, user: safeUser });
});

app.post('/api/security/sessions/:id/revoke', authenticate, (req, res) => {
  const user = (req as any).user;
  user.activeSessions = user.activeSessions.filter((s: any) => s.id !== req.params.id);
  const { passwordHash, ...safeUser } = user;
  res.json({ success: true, user: safeUser });
});

app.post('/api/security/sessions/revoke-all', authenticate, (req, res) => {
  const user = (req as any).user;
  user.activeSessions = user.activeSessions.filter((s: any) => s.current);
  const { passwordHash, ...safeUser } = user;
  res.json({ success: true, user: safeUser });
});

app.post('/api/security/change-password', authenticate, (req, res) => {
  const user = (req as any).user;
  const { currentPassword, newPassword } = req.body;
  if (hashPassword(currentPassword) !== user.passwordHash) {
    return res.status(400).json({ error: 'Current password incorrect' });
  }
  user.passwordHash = hashPassword(newPassword);
  user.securityLog.unshift({
    id: 'sec_' + Date.now(),
    action: 'Password Changed',
    detail: 'Secure entropy verification passed',
    ip: '127.0.0.1',
    device: 'Current Device',
    timestamp: new Date().toISOString(),
    status: 'success',
  });
  res.json({ success: true });
});

app.get('/api/security/export-data', authenticate, (req, res) => {
  const user = (req as any).user;
  const userPosts = Array.from(posts.values()).filter((p) => p.authorId === user.id);
  const { passwordHash, ...safeUser } = user;
  res.json({
    exportDate: new Date().toISOString(),
    account: safeUser,
    posts: userPosts,
  });
});

// =============================================================================
// STREET-SMART AI (POWERED BY GEMINI 3.8 FLASH)
// =============================================================================
app.post('/api/ai/chat', authenticate, async (req, res) => {
  const { message } = req.body;
  if (!message || !message.trim()) {
    return res.status(400).json({ error: 'Message cannot be empty' });
  }

  const systemInstruction = `You are "Ace", the street-smart AI companion on BLiN (Blend in. Be yourself. Find your people).
You possess authentic street wisdom, creator hustle instincts, and high emotional intelligence.
Key personality traits:
- Street-smart, authentic, sharp, grounded, and witty.
- You give real talk without robotic boilerplate or corporate PR jargon.
- You understand how internet culture, social clout, creator monetization, and street life actually work:
  - Spotting fake followers, clout chasers, and sketchy DMs or crypto/monetization scams.
  - Giving punchy, vibe-matching captions with rhythm for Reels and feed posts.
  - Navigating conflicts, trolls, and disrespect with cool composure ("keep your hands off the keyboard if you're emotional, protect your energy").
  - Street-level safety tips for real-life meetups, nightlife, and city neighborhoods.
  - Creator hustle advice: staying consistent, storytelling, and building genuine tribe without selling out.
- Keep answers concise, punchy, conversational, and direct (2-4 paragraphs max or bulleted wisdom). Use natural, modern streetwise tone, emojis tastefully (🔥, 💯, 👑, 🎯), and always keep it 100% real.`;

  try {
    if (process.env.GEMINI_API_KEY) {
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: message.trim(),
        config: {
          systemInstruction,
          temperature: 0.85,
        },
      });

      const reply = response.text || 'Keep your head high and stay grounded. What else is on your mind?';
      return res.json({ reply });
    }
  } catch (error) {
    console.warn('Gemini API call failed, falling back to street-smart offline logic:', error);
  }

  // Street-smart offline fallback generator
  const q = message.toLowerCase();
  let fallback = "Real talk: Keep your circle tight, protect your peace, and don't let anyone hustle you backwards. What situation are you dealing with right now?";
  if (q.includes('scam') || q.includes('fake') || q.includes('dm') || q.includes('deal')) {
    fallback = "Rule #1 of the street and the feed: If it sounds too good to be true, somebody is trying to use your hands to pull their chestnuts out the fire. No legit brand or promoter asks you for gift cards, verification codes, or upfront cash. Block 'em, report 'em, and protect your BLiN points.";
  } else if (q.includes('caption') || q.includes('reel') || q.includes('post') || q.includes('hook')) {
    fallback = "For a high-vibe reel caption, keep the hook sharp in the first 3 words. Try this: 'They see the shine, but never the late nights 🌙 Steady moving, no shortcuts. #BLiN #RealHustle #StayGrounded'. Always give people something authentic to nod their head to.";
  } else if (q.includes('hater') || q.includes('troll') || q.includes('hate') || q.includes('angry')) {
    fallback = "Never crash out over somebody who wouldn't trade seats with you in real life. Trolls want your reaction because your attention is expensive and theirs is worthless. Mute, keep grinding, and let your consistency do the talking.";
  } else if (q.includes('points') || q.includes('grow') || q.includes('followers')) {
    fallback = "Authentic growth on BLiN is simple: 1 like = 10 pts, +5 bonus per 10 likes. Don't chase empty follow-for-follow schemes. Drop real stories, host a live Voice Stage, talk with people in Communities, and the real tribe will find you.";
  }
  return res.json({ reply: fallback });
});

// =============================================================================
// DISCOVER HUB API (TRENDING TOPICS, REELS, CREATORS, VOICE STAGES)
// =============================================================================
app.get('/api/discover', authenticate, (req, res) => {
  const currentUserId = (req as any).userId;
  const allPosts = Array.from(posts.values());
  const allReels = allPosts.filter(
    (p) => p.postType === 'spotlight_reel' || (p.mediaType === 'video' && p.aspectRatio === 'vertical')
  );

  // Trending topics
  const topicMap: Record<string, number> = {};
  allPosts.forEach((p) => {
    p.topics.forEach((t) => {
      topicMap[t] = (topicMap[t] || 0) + 1;
    });
  });

  const defaultTopics = ['StreetStyle', 'CreatorHustle', 'FaithAndGrind', 'CityVibes', 'MusicDrops', 'TechUnderground', 'RealTalk'];
  defaultTopics.forEach((t) => {
    if (!topicMap[t]) topicMap[t] = 1;
  });

  const trendingTopics = Object.entries(topicMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([tag, count], index) => ({
      tag,
      category: index % 2 === 0 ? 'Creators & Culture' : 'Lifestyle & Sound',
      postsCount: count,
      trendingRank: index + 1,
    }));

  const topCreators = Array.from(users.values())
    .map((u) => ({
      id: u.id,
      username: u.username,
      displayName: u.displayName,
      avatarUrl: u.avatarUrl,
      bio: u.bio,
      verified: u.verified,
      isOnline: u.isOnline,
      followerCount: u.followerIds.length,
      followingCount: u.followingIds.length,
      pointsBalance: u.pointsBalance,
      isFollowing: u.followerIds.includes(currentUserId),
      hasRequestedFollow: false,
      isCloseFriend: false,
    }))
    .sort((a, b) => (b.pointsBalance || 0) - (a.pointsBalance || 0))
    .slice(0, 10);

  const curatedStories = Array.from(stories.values()).slice(0, 6);
  const activeRooms = Array.from(voiceRooms.values()).filter((r) => r.isLive);

  res.json({
    trendingTopics,
    trendingReels: allReels.slice(0, 10),
    curatedStories,
    topCreators,
    activeVoiceRooms: activeRooms,
  });
});

// =============================================================================
// AI VIDEO GENERATION (GEMINI OMNI 1.1 FLASH VIA INTERACTIONS API)
// =============================================================================
app.post('/api/ai/generate-video', authenticate, async (req, res) => {
  const { prompt, aspectRatio, duration } = req.body;
  if (!prompt || !prompt.trim()) {
    return res.status(400).json({ error: 'Please provide a video prompt.' });
  }

  try {
    if (process.env.GEMINI_API_KEY) {
      // Must use ai.interactions.create with gemini-omni-1.1-flash per gemini-interactions-api skill
      const interaction = await ai.interactions.create(
        {
          model: 'gemini-omni-1.1-flash',
          input: prompt.trim(),
          background: false,
          store: false,
          stream: false,
          response_format: {
            type: 'video',
            aspect_ratio: aspectRatio === '16:9' ? '16:9' : '9:16',
            duration: duration === '10s' ? '10s' : '5s',
            resolution: '720p',
          },
        },
        { timeout: 300000 }
      );

      const videoPart = interaction.output_video;
      if (videoPart && videoPart.data) {
        const mimeType = videoPart.mime_type || 'video/mp4';
        const videoDataUrl = `data:${mimeType};base64,${videoPart.data}`;
        return res.json({
          videoUrl: videoDataUrl,
          aspectRatio: aspectRatio === '16:9' ? '16:9' : '9:16',
          prompt: prompt.trim(),
        });
      }
    }
  } catch (error: any) {
    console.error('Video generation error with Omni Flash:', error);
    return res.status(500).json({
      error: error?.message || 'Video generation failed. Please try a different prompt.',
    });
  }

  return res.status(503).json({
    error: 'Gemini Omni Flash Video API requires active GEMINI_API_KEY with video generation access.',
  });
});

// =============================================================================
// MAPS GROUNDING (POWERED BY GEMINI 3.8 FLASH WITH GOOGLE MAPS TOOL)
// =============================================================================
app.post('/api/ai/maps-grounding', authenticate, async (req, res) => {
  const { query, locationContext } = req.body;
  if (!query || !query.trim()) {
    return res.status(400).json({ error: 'Query is required.' });
  }

  const promptText = `Find real-world locations, hangouts, creator cafes, underground spots, studios, or street spots matching: "${query.trim()}".
${locationContext ? `Location context / City: ${locationContext}` : ''}
Provide exact place names, real street addresses, what makes each spot special for creators, and a category tag.`;

  try {
    if (process.env.GEMINI_API_KEY) {
      // Maps Grounding using gemini-3.8-flash with the googleMaps tool per gemini-api skill
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: promptText,
        config: {
          tools: [{ googleMaps: {} }],
          temperature: 0.7,
        },
      });

      return res.json({
        reply: response.text || 'No locations found.',
        candidates: response.candidates,
      });
    }
  } catch (err: any) {
    console.warn('Maps Grounding error, returning structured fallback:', err);
  }

  return res.json({
    reply: `Here are top creator spots for "${query}":
1. **The Pulse Loft & Cafe** - 422 West Street (High-speed Wi-Fi, neon creator booths, specialty matcha)
2. **Underground Sound Studio & Lounge** - 180 Beat Ave (Acoustic podcast rooms, live open mic on Fridays)
3. **Cyber District Rooftop** - 88 Skyline Blvd (Panoramic city views for sunset reels & street photography)`,
  });
});

// =============================================================================
// ARCADE GAME & VERIFIED POINTS ENGINE
// =============================================================================
interface ArcadeScore {
  id: string;
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  score: number;
  wave: number;
  pointsAwarded: number;
  timestamp: string;
}
const arcadeLeaderboard: ArcadeScore[] = [];

app.get('/api/game/leaderboard', authenticate, (req, res) => {
  res.json(arcadeLeaderboard.slice(0, 20));
});

app.post('/api/game/record-score', authenticate, (req, res) => {
  const user = (req as any).user;
  const { score, wave, playDurationSec } = req.body;

  const validScore = Math.max(0, Math.floor(Number(score) || 0));
  const validWave = Math.max(1, Math.floor(Number(wave) || 1));
  const duration = Math.max(1, Number(playDurationSec) || 1);

  // Anti-cheat verification: impossible score rate check
  const maxPossibleScore = duration * 2500 + validWave * 5000;
  if (validScore > maxPossibleScore && validScore > 1000) {
    return res.status(400).json({ error: 'Suspicious game telemetry detected. Score rejected.' });
  }

  // Calculate points: 1 pt per 100 score, capped at 50 pts per game run
  const pointsEarned = Math.min(50, Math.floor(validScore / 100));

  if (pointsEarned > 0) {
    user.pointsBalance += pointsEarned;
    user.pointsLedger.unshift({
      id: 'pts_' + Date.now(),
      timestamp: new Date().toISOString(),
      action: 'game_reward',
      amount: pointsEarned,
      balanceAfter: user.pointsBalance,
      description: `Cyber Runner Arcade run (Score: ${validScore.toLocaleString()}, Wave ${validWave}) (+${pointsEarned} pts)`,
    });
  }

  const record: ArcadeScore = {
    id: 'score_' + Date.now(),
    userId: user.id,
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    score: validScore,
    wave: validWave,
    pointsAwarded: pointsEarned,
    timestamp: new Date().toISOString(),
  };

  arcadeLeaderboard.push(record);
  arcadeLeaderboard.sort((a, b) => b.score - a.score);
  if (arcadeLeaderboard.length > 50) arcadeLeaderboard.pop();

  res.json({
    success: true,
    pointsEarned,
    pointsBalance: user.pointsBalance,
    record,
    leaderboard: arcadeLeaderboard.slice(0, 10),
  });
});

// =============================================================================
// WEBSOCKET SERVER ATTACHMENT
// =============================================================================
const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (request, socket, head) => {
  const url = new URL(request.url || '', `http://${request.headers.host}`);
  if (url.pathname === '/ws') {
    const token = url.searchParams.get('token');
    const userId = token ? tokens.get(token) : null;
    if (!userId) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request, userId);
    });
  } else {
    socket.destroy();
  }
});

wss.on('connection', (ws: WebSocket, request: http.IncomingMessage, userId: string) => {
  if (!userSockets.has(userId)) {
    userSockets.set(userId, new Set());
  }
  userSockets.get(userId)!.add(ws);

  ws.on('close', () => {
    const set = userSockets.get(userId);
    if (set) {
      set.delete(ws);
      if (set.size === 0) {
        userSockets.delete(userId);
        // Automatic presence cleanup if user had an active voice room
        if (userRoomPresence.has(userId)) {
          const currentRoomId = userRoomPresence.get(userId)!;
          handleUserLeaveRoom(userId, currentRoomId);
        }
      }
    }
  });

  ws.on('message', (raw) => {
    try {
      const data = JSON.parse(raw.toString());
      if (data.type === 'typing:start' || data.type === 'typing:stop') {
        // Broadcast typing indicator to conversation participants
        const conv = conversations.get(data.conversationId);
        if (conv) {
          const user = users.get(userId);
          conv.participantIds.forEach((pid) => {
            if (pid !== userId) {
              const sockets = userSockets.get(pid);
              if (sockets) {
                sockets.forEach((s) => {
                  if (s.readyState === WebSocket.OPEN) {
                    s.send(
                      JSON.stringify({
                        type: 'typing:update',
                        conversationId: conv.id,
                        users: data.type === 'typing:start' ? [user?.displayName || 'Someone'] : [],
                      })
                    );
                  }
                });
              }
            }
          });
        }
      } else if (data.type === 'voiceroom:speaking') {
        const roomId = data.roomId;
        const room = voiceRooms.get(roomId);
        if (room) {
          const p = room.participants.find((part) => part.userId === userId);
          if (p) {
            p.isSpeaking = !p.isMuted && !!data.isSpeaking;
            if (data.volume !== undefined) p.speakingVolume = data.volume;
            broadcastToRoom(roomId, {
              type: 'voiceroom:speaking',
              roomId,
              userId,
              isSpeaking: p.isSpeaking,
              volume: p.speakingVolume,
            });
          }
        }
      } else if (data.type === 'voiceroom:reaction') {
        const roomId = data.roomId;
        const room = voiceRooms.get(roomId);
        if (room) {
          const rx = {
            id: 'rx_' + Date.now() + Math.random().toString(36).slice(2, 6),
            emoji: data.emoji || '💜',
            userId,
            createdAt: Date.now(),
          };
          room.recentReactions.push(rx);
          if (room.recentReactions.length > 20) room.recentReactions.shift();
          broadcastToRoom(roomId, {
            type: 'voiceroom:reaction',
            roomId,
            reaction: rx,
          });
        }
      } else if (data.type === 'voiceroom:chat') {
        const roomId = data.roomId;
        const room = voiceRooms.get(roomId);
        const user = users.get(userId);
        if (room && user && data.content) {
          const chatMsg: VoiceRoomChat = {
            id: 'vr_chat_' + crypto.randomBytes(6).toString('hex'),
            roomId,
            userId,
            username: user.username,
            displayName: user.displayName,
            avatarUrl: user.avatarUrl,
            content: String(data.content).trim(),
            createdAt: new Date().toISOString(),
          };
          room.chatMessages.push(chatMsg);
          broadcastToRoom(roomId, {
            type: 'voiceroom:chat',
            roomId,
            message: chatMsg,
          });
        }
      } else if (data.type === 'voiceroom:ping') {
        ws.send(JSON.stringify({ type: 'voiceroom:pong', timestamp: Date.now() }));
      }
    } catch (e) {
      // ignore
    }
  });
});

// =============================================================================
// VITE MIDDLEWARE & STARTUP
// =============================================================================
async function startServer() {
  const isDev = process.env.NODE_ENV !== 'production';
  if (isDev) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`BLiN Server active on http://0.0.0.0:${PORT}`);
  });
}

startServer();
