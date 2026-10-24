export interface BlinSettings {
  [key: string]: any;
  // 1. Account & Profile
  accountMode: 'public' | 'private' | 'creator';
  profileVisibility: 'public' | 'followers' | 'friends';
  profileTabOrder: string[];
  profileThemeStyle: 'cosmic' | 'neon' | 'sunset' | 'midnight' | 'emerald';
  profileAccentGlow: boolean;
  profileMusicTrack: string;
  pronunciationText: string;
  pronunciationAudioUrl: string;
  usernameChangeAlerts: boolean;
  showStatsPublicly: boolean;
  showFollowersList: 'everyone' | 'followers' | 'nobody';

  // 2. Privacy & Safety
  onlineStatus: 'everyone' | 'contacts' | 'nobody';
  lastSeen: 'everyone' | 'contacts' | 'nobody';
  readReceipts: boolean;
  typingIndicator: boolean;
  activityIndicatorStyle: 'full' | 'subtle' | 'off';
  requireFollowApproval: boolean;
  whoCanMessageYou: 'everyone' | 'following' | 'nobody';
  whoCanAddToGroups: 'everyone' | 'following' | 'nobody';
  whoCanMentionYou: 'everyone' | 'following' | 'nobody';
  whoCanTagYou: 'everyone' | 'following' | 'nobody';
  mentionApproval: boolean;
  tagApproval: boolean;
  antiSpamLevel: 'relaxed' | 'standard' | 'strict';
  suspiciousLinkWarnings: boolean;
  commentSlowModeSeconds: number;
  impersonationAlerts: boolean;
  accountDiscoveryByEmailPhone: boolean;
  contactSyncing: boolean;
  personalizedRecommendations: boolean;
  locationSharing: 'precise' | 'approximate' | 'off';
  allowContentDownload: boolean;
  safetyNotifications: boolean;
  privacyCheckupCompletedAt: string | null;

  // 3. Feed Personalization
  feedCategories: string[];
  feedBalanceFriends: number;
  feedBalanceCreators: number;
  feedBalanceCommunities: number;
  feedBalanceRecommended: number;
  topicPriorities: string[];
  creatorContentFrequencyCap: 'relaxed' | 'balanced' | 'strict';
  followingOnlyMode: boolean;
  excludedTopics: string[];
  seenContentFilter: boolean;
  freshContentMode: boolean;
  localDiscovery: boolean;
  sensitiveContentFilter: 'standard' | 'strict' | 'relaxed';
  autoplayVideos: 'always' | 'wifi_only' | 'never';
  recommendationPauseUntil: string | null;

  // 4. Messaging & Chat
  defaultChatWallpaper: string;
  defaultBubbleColor: 'violet' | 'blue' | 'cyan' | 'emerald' | 'rose';
  messageFontScale: 'small' | 'medium' | 'large';
  enterToSend: boolean;
  messagePreviewsInNotifications: boolean;
  chatSortOrder: 'recent' | 'unread' | 'favorites';
  swipeLeftAction: 'archive' | 'mute' | 'delete' | 'pin';
  swipeRightAction: 'pin' | 'mark_unread' | 'call';
  unreadOnlyChatView: boolean;
  messageTranslation: boolean;
  voiceMessageTranscription: boolean;
  voicePlaybackSpeed: '1x' | '1.25x' | '1.5x' | '2x';
  emojiReplacementSuggestions: boolean;
  gifAndStickerEnabled: boolean;
  defaultQuickReaction: string;
  replyPreviews: boolean;
  linkPreviews: boolean;
  mediaDownloadQuality: 'standard' | 'hd' | 'data_saver';
  wifiOnlyMediaDownloads: boolean;
  defaultDisappearingTimer: 'off' | '24h' | '7d' | '30d';
  autoArchiveInactiveChats: boolean;
  chatBackupSchedule: 'daily' | 'weekly' | 'manual' | 'off';
  chatBackupEncrypted: boolean;
  unknownSenderScreening: boolean;
  messageRequestExpirationDays: number;
  groupInviteApproval: boolean;
  groupMentionNotifications: 'all' | 'direct_only' | 'off';
  callQualityMode: 'standard' | 'hd' | 'low_latency';
  chatLockEnabled: boolean;
  chatLockPin: string;

  // 5. Spotlight & Video Creator
  defaultRecordingResolution: '720p' | '1080p' | '4k';
  defaultFrameRate: '30fps' | '60fps';
  cameraGridAlignment: boolean;
  defaultCameraFacing: 'front' | 'rear';
  defaultRecordingTimerSec: 0 | 3 | 10;
  videoUploadQuality: 'standard' | 'highest' | 'saver';
  draftAutoSave: boolean;
  videoCoverTemplate: 'clean' | 'card' | 'cinematic';
  trendingAudioSuggestions: boolean;
  licenseSafeMusicOnly: boolean;
  soundEffectsVolumePercent: number;
  remixPermission: 'everyone' | 'followers' | 'nobody';
  stitchPermission: 'everyone' | 'followers' | 'nobody';
  autoCaptionGeneration: boolean;
  alwaysShowVideoCaptions: boolean;
  interactiveStickersDefault: boolean;
  allowDuets: boolean;
  spotlightLoopCount: number;

  // 6. Stories & 24h Moments
  defaultStoryAudience: 'everyone' | 'followers' | 'close_friends';
  storyAutoArchive: boolean;
  allowStoryReplies: 'everyone' | 'followers' | 'nobody';
  allowStorySharingToFeed: boolean;
  showStoryViewersCount: boolean;
  storyCountdownFormat: 'standard' | 'compact';
  screenshotNotificationStories: boolean;
  autoColorPaletteStoryGradients: boolean;
  storyMusicSync: boolean;
  storyReactionEmojis: string[];

  // 7. Notifications
  pushNotificationsEnabled: boolean;
  inAppBanners: boolean;
  soundAlerts: boolean;
  vibrationHaptics: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  summaryDigestMode: 'off' | 'morning' | 'evening';
  notifyOnLikes: boolean;
  notifyOnComments: boolean;
  notifyOnNewFollowers: boolean;
  notifyOnMentions: boolean;
  notifyOnDirectMessages: boolean;
  notifyOnGroupMessages: boolean;
  notifyOnVoiceRooms: boolean;
  notifyOnPointsMilestones: boolean;
  notifyOnCreatorLive: boolean;
  emailNewsletter: boolean;
  smsSecurityAlerts: boolean;

  // 8. Appearance & Theme
  appTheme: 'cosmic_dark' | 'midnight_blue' | 'deep_space' | 'obsidian';
  accentColor: 'violet' | 'cyan' | 'pink' | 'emerald' | 'amber';
  fontFamily: 'outfit' | 'inter' | 'jakarta' | 'mono';
  contentFontSize: 'compact' | 'normal' | 'relaxed';
  layoutDensity: 'compact' | 'comfortable' | 'spacious';
  reduceMotion: boolean;
  highContrastMode: boolean;
  screenReaderOptimization: boolean;
  customAppIcon: 'default' | 'neon' | 'glow' | 'minimal';
  hapticFeedbackStrength: 'light' | 'medium' | 'strong' | 'off';

  // 9. Security & Authentication
  twoFactorEnabled: boolean;
  twoFactorMethod: 'app' | 'sms' | 'email';
  passkeysEnabled: boolean;
  loginAlerts: boolean;
  autoSessionTimeoutMinutes: number;
  requireBiometricsForWallet: boolean;
  lockAppOnBackground: boolean;
  lockAppGracePeriodSeconds: number;
  blockScreenshotsInPrivateChats: boolean;
  endToEndEncryptionVerified: boolean;
  trustedDevicesOnly: boolean;

  // 10. Communities & Groups
  communityDefaultView: 'feed' | 'discussions' | 'voice';
  autoJoinTrendingCommunities: boolean;
  communityInviteFilter: 'everyone' | 'friends_only';
  communityBadgeVisibility: boolean;
  communityNotificationFrequency: 'all' | 'highlights' | 'mentions_only';
  moderationShieldActive: boolean;

  // 11. Creator Tools & Monetization
  creatorDashboardEnabled: boolean;
  creatorBadgeVisible: boolean;
  monetizationTippingActive: boolean;
  tippingCurrency: 'blin_points' | 'diamonds';
  autoWatermarkVideos: boolean;
  brandedContentTagging: boolean;
  collaboratorSplits: boolean;
  analyticsDetailLevel: 'basic' | 'pro';
  scheduledPostingAllowed: boolean;
  creatorLiveGifting: boolean;

  // 12. BLiN Points & Rewards
  pointsEarningActive: boolean;
  showPointsBadgeOnProfile: boolean;
  pointsSoundEffects: boolean;
  dailyStreakReminder: boolean;
  autoClaimDailyQuests: boolean;
  pointsLedgerPublic: boolean;
  lowBalanceAlertThreshold: number;

  // 13. Smart Experience & Content Filters
  smartFeedRanking: boolean;
  autoTranslatePosts: boolean;
  preferredLanguage: string;
  autoSummarizeLongDiscussions: boolean;
  aiSuggestedRepliesInChat: boolean;
  hashtagAssistant: boolean;
  altTextAssistant: boolean;
  filterLowQualityComments: boolean;
  contentQualityPreference: 'quality' | 'balanced' | 'fast';

  // 14. Data, Storage & Cache
  dataSaverMode: boolean;
  autoClearCacheDays: number;
  offlineDownloadsAllowed: boolean;
  mediaPreloadStrategy: 'aggressive' | 'balanced' | 'conservative';
  exportDataFormat: 'json' | 'html';
  backupIncludeMedia: boolean;

  // 15. Compliance, Legal & Support
  analyticsConsent: boolean;
  crashReportingConsent: boolean;
  adPreferencesPersonalized: boolean;
  ageVerified: boolean;
  copyrightProtectionNotices: boolean;
  supportPriority: 'standard' | 'creator';
  defaultUploadAudience: 'public' | 'followers' | 'private';
}

export interface ActiveSession {
  id: string;
  device: string;
  browser: string;
  os: string;
  ip: string;
  location: string;
  current: boolean;
  createdAt: string;
  lastActiveAt: string;
}

export interface SecurityAuditLogEntry {
  id: string;
  action: string;
  detail: string;
  ip: string;
  device: string;
  timestamp: string;
  status: 'success' | 'warning' | 'alert';
}

export interface PointsLedgerEntry {
  id: string;
  timestamp: string;
  action: 'like_received' | 'like_milestone_bonus' | 'follow_received' | 'streak_bonus' | 'creator_tip' | 'manual_grant';
  amount: number;
  balanceAfter: number;
  description: string;
  sourceUserId?: string;
  targetPostId?: string;
}

export interface UserAccount {
  [key: string]: any;
  id: string;
  username: string;
  displayName: string;
  email: string;
  dateOfBirth: string;
  avatarUrl: string;
  bio: string;
  pronouns?: string;
  location?: string;
  website?: string;
  verified: boolean;
  isOnline: boolean;
  pointsBalance: number;
  streakDays: number;
  settings: BlinSettings;
  followerIds: string[];
  followingIds: string[];
  blockedUserIds: string[];
  restrictedUserIds: string[];
  closeFriendIds: string[];
  hiddenWords: string[];
  hiddenPostIds: string[];
  pendingFollowRequestIds: string[];
  activeSessions: ActiveSession[];
  securityLog: SecurityAuditLogEntry[];
  pointsLedger: PointsLedgerEntry[];
  twoFactorSecret?: string;
  recoveryCodes: string[];
  createdAt: string;
  updatedAt: string;
}

export interface PublicUserSummary {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  bio: string;
  verified: boolean;
  isOnline: boolean;
  followerCount: number;
  followingCount: number;
  pointsBalance: number | null;
  isFollowing: boolean;
  hasRequestedFollow: boolean;
  isCloseFriend: boolean;
}

export interface PostComment {
  id: string;
  authorId: string;
  authorUsername: string;
  authorDisplayName: string;
  authorAvatar: string;
  content: string;
  createdAt: string;
  likeCount: number;
}

export interface PostItem {
  id: string;
  authorId: string;
  authorUsername?: string;
  authorDisplayName?: string;
  authorAvatar?: string;
  authorVerified?: boolean;
  postType: 'feed' | 'spotlight_reel';
  caption: string;
  mediaUrl?: string;
  mediaType: 'image' | 'video' | 'none';
  aspectRatio?: 'vertical' | 'standard' | 'square';
  videoDuration?: string;
  audioAttribution?: string;
  soundWaveform?: number[];
  topics: string[];
  audience: 'public' | 'followers' | 'private';
  allowComments: boolean;
  likeUserIds: string[];
  repostUserIds: string[];
  savedUserIds: string[];
  shareCount: number;
  comments: PostComment[];
  createdAt: string;
}

export interface StoryItem {
  id: string;
  authorId: string;
  authorName: string;
  authorUsername: string;
  authorAvatar: string;
  text?: string;
  mediaUrl?: string;
  backgroundGradient: string;
  audience: 'everyone' | 'followers' | 'close_friends';
  createdAt: string;
  expiresAt: string;
  viewers: string[];
}

export interface CommunityItem {
  [key: string]: any;
  id: string;
  name: string;
  category: string;
  description: string;
  avatarGradient: string;
  creatorId: string;
  creatorUsername: string;
  memberIds: string[];
  isPrivate: boolean;
  createdAt: string;
}

export interface ChatMessage {
  [key: string]: any;
  id: string;
  conversationId: string;
  senderId: string;
  senderUsername: string;
  senderDisplayName: string;
  senderAvatar: string;
  content: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'voice' | 'file';
  voiceDurationSec?: number;
  readByUserIds: string[];
  deliveredToUserIds: string[];
  reactions: Record<string, string[]>; // emoji -> array of userIds
  replyToMessageId?: string;
  replyToSnippet?: string;
  isEdited?: boolean;
  isDeleted?: boolean;
  encrypted?: boolean;
  createdAt: string;
}

export interface PerChatOverride {
  [key: string]: any;
  wallpaper?: string;
  bubbleColor?: 'violet' | 'blue' | 'cyan' | 'emerald' | 'rose';
  isMuted?: boolean;
  muteUntil?: string | null;
  customSound?: string;
  isPinned?: boolean;
  isArchived?: boolean;
}

export interface Conversation {
  [key: string]: any;
  id: string;
  isGroup: boolean;
  title?: string;
  avatarUrl?: string;
  participantIds: string[];
  lastMessage?: ChatMessage | null;
  unreadCount?: number;
  overrides?: Record<string, PerChatOverride>; // userId -> override
  createdAt: string;
  updatedAt: string;
}

export interface VoiceParticipant {
  id: string;
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  role: 'host' | 'speaker' | 'listener';
  isMuted: boolean;
  isSpeaking: boolean;
  raisedHand: boolean;
  joinedAt: string;
  speakingVolume?: number;
}

export interface VoiceRoomChat {
  id: string;
  roomId: string;
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  content: string;
  createdAt: string;
}

export interface VoiceRoomItem {
  id: string;
  title: string;
  description: string;
  topic: string;
  hostId: string;
  hostUsername: string;
  hostDisplayName: string;
  hostAvatar: string;
  isLive: boolean;
  participants: VoiceParticipant[];
  chatMessages: VoiceRoomChat[];
  listenersCount: number;
  recentReactions: { id: string; emoji: string; userId: string; createdAt: number }[];
  createdAt: string;
}

export interface SupportSubmission {
  [key: string]: any;
  id: string;
  userId: string;
  category: string;
  subject: string;
  details: string;
  status: 'received' | 'investigating' | 'resolved';
  createdAt: string;
}

export interface SecurityCenterChecklist {
  twoFactorEnabled: boolean;
  strongPasswordSet: boolean;
  suspiciousLoginAlertsOn: boolean;
  activeSessionsReviewed: boolean;
  endToEndKeyVerified: boolean;
  recoveryCodesSaved: boolean;
  unknownSenderScreeningOn: boolean;
  biometricsOrPinLocked: boolean;
  contentDownloadProtected: boolean;
  privacyCheckupCompleted: boolean;
  rateLimitingGuarded: boolean;
  pointsLedgerAudited: boolean;
}

export interface AIMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
  category?: 'street_advice' | 'scam_check' | 'caption_gen' | 'general' | 'creator_game';
}

export interface DiscoverTopic {
  tag: string;
  category: string;
  postsCount: number;
  trendingRank: number;
}

export interface DiscoverData {
  trendingTopics: DiscoverTopic[];
  trendingReels: PostItem[];
  curatedStories: StoryItem[];
  topCreators: PublicUserSummary[];
  activeVoiceRooms: VoiceRoomItem[];
}

