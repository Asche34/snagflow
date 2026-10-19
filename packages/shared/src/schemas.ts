/**
 * Zod schemas shared by the web app, the mobile app, and route handlers.
 * Mirrors the Postgres constraints in the migrations; keep both in sync
 * (the DB remains the authority, these give friendly client feedback).
 */
import { z } from "zod";
import { PHOTO_KINDS, SNAG_PRIORITIES, SNAG_STATUSES } from "./workflow.js";

export const UUIDSchema = z.string().uuid();

/** Matches the storage path convention {project_id}/{snag_id}/{uuid}.jpg */
export const StoragePathSchema = z
  .string()
  .regex(
    /^[0-9a-f-]{36}\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpe?g|png|webp)$/i,
    "Storage path must follow {project_id}/{snag_id}/{uuid}.(jpg|jpeg|png|webp)",
  );

export const SnagStatusSchema = z.enum(SNAG_STATUSES);
export const SnagPrioritySchema = z.enum(SNAG_PRIORITIES);
export const PhotoKindSchema = z.enum(PHOTO_KINDS);

export const ProjectRoleSchema = z.enum(["manager", "member", "viewer"]);

// ---------------------------------------------------------------------------
// Snags
// ---------------------------------------------------------------------------

export const SnagCreateSchema = z.object({
  /** Idempotency key for offline creates (outbox replays). */
  clientId: UUIDSchema,
  projectId: UUIDSchema,
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(5000).optional().nullable(),
  priority: SnagPrioritySchema.default("medium"),
  categoryId: UUIDSchema.optional().nullable(),
  locationId: UUIDSchema.optional().nullable(),
  assigneeId: UUIDSchema.optional().nullable(),
  dueDate: z.string().date().optional().nullable(),
});
export type SnagCreate = z.infer<typeof SnagCreateSchema>;

export const SnagUpdateSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().max(5000).optional().nullable(),
    priority: SnagPrioritySchema.optional(),
    categoryId: UUIDSchema.optional().nullable(),
    locationId: UUIDSchema.optional().nullable(),
    dueDate: z.string().date().optional().nullable(),
    /** Optional plan pin. */
    pinX: z.number().min(0).max(1).optional().nullable(),
    pinY: z.number().min(0).max(1).optional().nullable(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Nothing to update" });
export type SnagUpdate = z.infer<typeof SnagUpdateSchema>;

/** Workflow verbs are the shared map's transition actions. */
export const SnagAssignSchema = z.object({
  snagId: UUIDSchema,
  assigneeId: UUIDSchema.nullable(),
});

export const SnagTransitionSchema = z.object({
  snagId: UUIDSchema,
  toStatus: SnagStatusSchema,
  comment: z.string().trim().max(5000).optional(),
});
export type SnagTransition = z.infer<typeof SnagTransitionSchema>;

// ---------------------------------------------------------------------------
// Projects, locations, categories
// ---------------------------------------------------------------------------

export const ProjectCreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  code: z
    .string()
    .trim()
    .min(1)
    .max(12)
    .regex(/^[A-Za-z0-9_-]+$/, "Letters, numbers, dash and underscore only"),
  description: z.string().trim().max(2000).optional().nullable(),
  clientName: z.string().trim().max(120).optional().nullable(),
  address: z.string().trim().max(300).optional().nullable(),
  requireFixPhoto: z.boolean().default(true),
});
export type ProjectCreate = z.infer<typeof ProjectCreateSchema>;

export const ProjectUpdateSchema = ProjectCreateSchema.partial();

export const LocationCreateSchema = z.object({
  projectId: UUIDSchema,
  parentId: UUIDSchema.optional().nullable(),
  name: z.string().trim().min(1).max(120),
  sortOrder: z.number().int().min(0).default(0),
});
export type LocationCreate = z.infer<typeof LocationCreateSchema>;

export const CategoryCreateSchema = z.object({
  projectId: UUIDSchema,
  name: z.string().trim().min(1).max(60),
});

// ---------------------------------------------------------------------------
// Comments, invites, members
// ---------------------------------------------------------------------------

export const CommentCreateSchema = z.object({
  snagId: UUIDSchema,
  body: z.string().trim().min(1).max(5000),
});

export const InviteCreateSchema = z.object({
  email: z.string().trim().email().max(254),
  projectId: UUIDSchema.optional().nullable(),
  role: ProjectRoleSchema.optional().default("member"),
});
export type InviteCreate = z.infer<typeof InviteCreateSchema>;

export const MemberUpsertSchema = z.object({
  projectId: UUIDSchema,
  userId: UUIDSchema,
  role: ProjectRoleSchema,
});

// ---------------------------------------------------------------------------
// Reports (spec section 10)
// ---------------------------------------------------------------------------

export const ReportGroupBySchema = z.enum(["location", "assignee", "status", "category"]);
export const ReportSortBySchema = z.enum(["number", "priority", "due_date"]);
export const ReportThemeSchema = z.enum(["classic", "compact", "photo_first"]);
export const ReportPhotoSizeSchema = z.enum(["small", "medium", "large", "one_per_page"]);

export const ReportFiltersSchema = z.object({
  status: z.array(SnagStatusSchema).optional(),
  assigneeId: UUIDSchema.optional().nullable(),
  locationId: UUIDSchema.optional().nullable(),
  categoryId: UUIDSchema.optional().nullable(),
  priority: z.array(SnagPrioritySchema).optional(),
  /** "exclude closed before date X" */
  closedBefore: z.string().date().optional(),
  createdFrom: z.string().date().optional(),
  createdTo: z.string().date().optional(),
});

export const ReportOptionsSchema = z.object({
  coverPage: z.boolean().default(true),
  includePhotos: z.boolean().default(true),
  useAnnotated: z.boolean().default(true),
  photoSize: ReportPhotoSizeSchema.default("medium"),
  includeComments: z.boolean().default(false),
  includeTimestamps: z.boolean().default(true),
  includeFixPhotos: z.boolean().default(true),
  groupBy: ReportGroupBySchema.optional(),
  sortBy: ReportSortBySchema.default("number"),
  theme: ReportThemeSchema.default("classic"),
});
export type ReportOptions = z.infer<typeof ReportOptionsSchema>;

export const ReportRequestSchema = z.object({
  projectId: UUIDSchema,
  format: z.enum(["pdf", "xlsx"]),
  filters: ReportFiltersSchema.default({}),
  options: ReportOptionsSchema.default({}),
});
export type ReportRequest = z.infer<typeof ReportRequestSchema>;

/** Terminal errors returned by the transition RPCs; UI maps codes to copy. */
export const SnagRpcErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
});
