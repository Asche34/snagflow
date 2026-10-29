
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "activity_log": {
                  Row: {
                    "action": string,"actor_id": string,"created_at": string,"from_value": string | null,"id": string,"meta": NonNullable<Json>,"project_id": string,"snag_id": string | null,"to_value": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id": string,"created_at"?: string,"from_value"?: string | null,"id"?: string,"meta"?: NonNullable<Json>,"project_id": string,"snag_id"?: string | null,"to_value"?: string | null
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string,"created_at"?: string,"from_value"?: string | null,"id"?: string,"meta"?: NonNullable<Json>,"project_id"?: string,"snag_id"?: string | null,"to_value"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "activity_log_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "activity_log_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "activity_log_snag_id_fkey"
      columns: ["snag_id"]
isOneToOne: false
      referencedRelation: "snags"
      referencedColumns: ["id"]
    }
                  ]
                },"categories": {
                  Row: {
                    "created_at": string,"id": string,"name": string,"project_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"name": string,"project_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"name"?: string,"project_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "categories_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id"]
    }
                  ]
                },"comments": {
                  Row: {
                    "author_id": string,"body": string,"created_at": string,"id": string,"snag_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "author_id": string,"body": string,"created_at"?: string,"id"?: string,"snag_id": string
                  }
                  Update: {
                    "author_id"?: string,"body"?: string,"created_at"?: string,"id"?: string,"snag_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "comments_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "comments_snag_id_fkey"
      columns: ["snag_id"]
isOneToOne: false
      referencedRelation: "snags"
      referencedColumns: ["id"]
    }
                  ]
                },"invites": {
                  Row: {
                    "accepted_at": string | null,"created_at": string,"email": string,"expires_at": string,"id": string,"invited_by": string,"project_id": string | null,"role": Database["public"]['Enums']["project_role"],"token": string
                  }
                  ComputedFields: never
                  Insert: {
                    "accepted_at"?: string | null,"created_at"?: string,"email": string,"expires_at"?: string,"id"?: string,"invited_by": string,"project_id"?: string | null,"role"?: Database["public"]['Enums']["project_role"],"token"?: string
                  }
                  Update: {
                    "accepted_at"?: string | null,"created_at"?: string,"email"?: string,"expires_at"?: string,"id"?: string,"invited_by"?: string,"project_id"?: string | null,"role"?: Database["public"]['Enums']["project_role"],"token"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "invites_invited_by_fkey"
      columns: ["invited_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invites_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id"]
    }
                  ]
                },"locations": {
                  Row: {
                    "created_at": string,"id": string,"name": string,"parent_id": string | null,"plan_path": string | null,"project_id": string,"sort_order": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"name": string,"parent_id"?: string | null,"plan_path"?: string | null,"project_id": string,"sort_order"?: number,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"name"?: string,"parent_id"?: string | null,"plan_path"?: string | null,"project_id"?: string,"sort_order"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "locations_parent_id_fkey"
      columns: ["parent_id"]
isOneToOne: false
      referencedRelation: "locations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "locations_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id"]
    }
                  ]
                },"notifications": {
                  Row: {
                    "created_at": string,"id": string,"payload": NonNullable<Json>,"project_id": string | null,"read_at": string | null,"snag_id": string | null,"type": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"payload"?: NonNullable<Json>,"project_id"?: string | null,"read_at"?: string | null,"snag_id"?: string | null,"type": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"payload"?: NonNullable<Json>,"project_id"?: string | null,"read_at"?: string | null,"snag_id"?: string | null,"type"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notifications_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notifications_snag_id_fkey"
      columns: ["snag_id"]
isOneToOne: false
      referencedRelation: "snags"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notifications_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"org_settings": {
                  Row: {
                    "company_name": string,"created_at": string,"date_format": string,"default_report_theme": string,"id": number,"logo_path": string | null,"terminology": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "company_name"?: string,"created_at"?: string,"date_format"?: string,"default_report_theme"?: string,"id"?: number,"logo_path"?: string | null,"terminology"?: string,"updated_at"?: string
                  }
                  Update: {
                    "company_name"?: string,"created_at"?: string,"date_format"?: string,"default_report_theme"?: string,"id"?: number,"logo_path"?: string | null,"terminology"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"profiles": {
                  Row: {
                    "avatar_url": string | null,"created_at": string,"email": string,"full_name": string,"id": string,"is_active": boolean,"is_admin": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "avatar_url"?: string | null,"created_at"?: string,"email": string,"full_name"?: string,"id": string,"is_active"?: boolean,"is_admin"?: boolean
                  }
                  Update: {
                    "avatar_url"?: string | null,"created_at"?: string,"email"?: string,"full_name"?: string,"id"?: string,"is_active"?: boolean,"is_admin"?: boolean
                  }
                  Relationships: [
                    
                  ]
                },"project_members": {
                  Row: {
                    "created_at": string,"project_id": string,"role": Database["public"]['Enums']["project_role"],"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"project_id": string,"role": Database["public"]['Enums']["project_role"],"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"project_id"?: string,"role"?: Database["public"]['Enums']["project_role"],"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "project_members_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "project_members_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"projects": {
                  Row: {
                    "address": string | null,"client_name": string | null,"code": string,"cover_image_path": string | null,"created_at": string,"created_by": string,"description": string | null,"id": string,"name": string,"require_fix_photo": boolean,"snag_counter": number,"status": Database["public"]['Enums']["project_state"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "address"?: string | null,"client_name"?: string | null,"code": string,"cover_image_path"?: string | null,"created_at"?: string,"created_by": string,"description"?: string | null,"id"?: string,"name": string,"require_fix_photo"?: boolean,"snag_counter"?: number,"status"?: Database["public"]['Enums']["project_state"],"updated_at"?: string
                  }
                  Update: {
                    "address"?: string | null,"client_name"?: string | null,"code"?: string,"cover_image_path"?: string | null,"created_at"?: string,"created_by"?: string,"description"?: string | null,"id"?: string,"name"?: string,"require_fix_photo"?: boolean,"snag_counter"?: number,"status"?: Database["public"]['Enums']["project_state"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "projects_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"push_tokens": {
                  Row: {
                    "created_at": string,"last_seen_at": string,"platform": string,"token": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"last_seen_at"?: string,"platform": string,"token": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"last_seen_at"?: string,"platform"?: string,"token"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "push_tokens_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"reports": {
                  Row: {
                    "created_at": string,"created_by": string,"filters": NonNullable<Json>,"format": Database["public"]['Enums']["report_format"],"id": string,"options": NonNullable<Json>,"project_id": string,"revision": number,"storage_path": string,"theme": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by": string,"filters"?: NonNullable<Json>,"format": Database["public"]['Enums']["report_format"],"id"?: string,"options"?: NonNullable<Json>,"project_id": string,"revision": number,"storage_path": string,"theme"?: string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string,"filters"?: NonNullable<Json>,"format"?: Database["public"]['Enums']["report_format"],"id"?: string,"options"?: NonNullable<Json>,"project_id"?: string,"revision"?: number,"storage_path"?: string,"theme"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "reports_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reports_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id"]
    }
                  ]
                },"snag_photos": {
                  Row: {
                    "annotated_path": string | null,"annotation_json": Json | null,"created_at": string,"height": number,"id": string,"kind": Database["public"]['Enums']["photo_kind"],"snag_id": string,"sort_order": number,"storage_path": string,"taken_at": string,"thumb_path": string | null,"updated_at": string,"uploaded_by": string,"width": number
                  }
                  ComputedFields: never
                  Insert: {
                    "annotated_path"?: string | null,"annotation_json"?: Json | null,"created_at"?: string,"height": number,"id"?: string,"kind"?: Database["public"]['Enums']["photo_kind"],"snag_id": string,"sort_order"?: number,"storage_path": string,"taken_at"?: string,"thumb_path"?: string | null,"updated_at"?: string,"uploaded_by": string,"width": number
                  }
                  Update: {
                    "annotated_path"?: string | null,"annotation_json"?: Json | null,"created_at"?: string,"height"?: number,"id"?: string,"kind"?: Database["public"]['Enums']["photo_kind"],"snag_id"?: string,"sort_order"?: number,"storage_path"?: string,"taken_at"?: string,"thumb_path"?: string | null,"updated_at"?: string,"uploaded_by"?: string,"width"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "snag_photos_snag_id_fkey"
      columns: ["snag_id"]
isOneToOne: false
      referencedRelation: "snags"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "snag_photos_uploaded_by_fkey"
      columns: ["uploaded_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"snags": {
                  Row: {
                    "assignee_id": string | null,"category_id": string | null,"client_id": string,"closed_at": string | null,"closed_by": string | null,"created_at": string,"created_by": string,"deleted_at": string | null,"description": string | null,"due_date": string | null,"id": string,"location_id": string | null,"number": number,"pin_x": number | null,"pin_y": number | null,"priority": Database["public"]['Enums']["snag_priority"],"project_id": string,"rejection_count": number,"search_document": unknown,"status": Database["public"]['Enums']["snag_status"],"title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "assignee_id"?: string | null,"category_id"?: string | null,"client_id"?: string,"closed_at"?: string | null,"closed_by"?: string | null,"created_at"?: string,"created_by": string,"deleted_at"?: string | null,"description"?: string | null,"due_date"?: string | null,"id"?: string,"location_id"?: string | null,"number": number,"pin_x"?: number | null,"pin_y"?: number | null,"priority"?: Database["public"]['Enums']["snag_priority"],"project_id": string,"rejection_count"?: number,"search_document"?: never,"status"?: Database["public"]['Enums']["snag_status"],"title": string,"updated_at"?: string
                  }
                  Update: {
                    "assignee_id"?: string | null,"category_id"?: string | null,"client_id"?: string,"closed_at"?: string | null,"closed_by"?: string | null,"created_at"?: string,"created_by"?: string,"deleted_at"?: string | null,"description"?: string | null,"due_date"?: string | null,"id"?: string,"location_id"?: string | null,"number"?: number,"pin_x"?: number | null,"pin_y"?: number | null,"priority"?: Database["public"]['Enums']["snag_priority"],"project_id"?: string,"rejection_count"?: number,"search_document"?: never,"status"?: Database["public"]['Enums']["snag_status"],"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "snags_assignee_id_fkey"
      columns: ["assignee_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "snags_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "snags_closed_by_fkey"
      columns: ["closed_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "snags_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "snags_location_id_fkey"
      columns: ["location_id"]
isOneToOne: false
      referencedRelation: "locations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "snags_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "accept_project_invite":
{ Args: { "p_full_name": string,"p_token": string }; Returns: string
                           },
"add_project_member":
{ Args: { "p_email": string,"p_project_id": string,"p_role": Database["public"]['Enums']["project_role"] }; Returns: string
                           },
"assign_snag":
{ Args: { "p_assignee_id": string,"p_snag_id": string }; Returns: Json
                           },
"can":
{ Args: { "pid": string,"pname": string }; Returns: boolean
                           },
"cancel_project_invite":
{ Args: { "p_id": string }; Returns: undefined
                           },
"get_my_project_invite":
{ Args: { "p_token": string }; Returns: {
              "accepted": boolean,"email": string,"project_id": string,"project_name": string,"role": Database["public"]['Enums']["project_role"]
            }[]
                           },
"is_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_project_manager":
{ Args: { "pid": string }; Returns: boolean
                           },
"is_project_member":
{ Args: { "pid": string }; Returns: boolean
                           },
"notify_managers":
{ Args: { "p_payload": Json,"p_project_id": string,"p_snag_id": string,"p_type": string }; Returns: undefined
                           },
"prepare_project_invite":
{ Args: { "p_email": string,"p_id": string,"p_project_id": string,"p_role": Database["public"]['Enums']["project_role"] }; Returns: {
              "id": string,"token": string
            }[]
                           },
"project_role":
{ Args: { "pid": string }; Returns: Database["public"]['Enums']["project_role"]
                           },
"set_project_member":
{ Args: { "p_project_id": string,"p_role": Database["public"]['Enums']["project_role"],"p_user_id": string }; Returns: undefined
                           },
"shares_project_with_me":
{ Args: { "target": string }; Returns: boolean
                           },
"show_limit":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"show_trgm":
{ Args: { "": string }; Returns: (string)[]
                           },
"snag_activity":
{ Args: { "p_action": string,"p_actor_id": string,"p_from_value": string,"p_meta"?: Json,"p_project_id": string,"p_snag_id": string,"p_to_value": string }; Returns: undefined
                           },
"snag_notify":
{ Args: { "p_payload": Json,"p_project_id": string,"p_snag_id": string,"p_type": string,"p_user_id": string }; Returns: undefined
                           },
"soft_delete_snag":
{ Args: { "p_snag_id": string }; Returns: undefined
                           },
"storage_project_id":
{ Args: { "path": string }; Returns: string
                           },
"transition_snag":
{ Args: { "p_comment"?: string,"p_snag_id": string,"p_to_status": Database["public"]['Enums']["snag_status"] }; Returns: Json
                           }
          }
          Enums: {
            "photo_kind": "issue"|"fix","project_role": "manager"|"member"|"viewer","project_state": "active"|"archived","report_format": "pdf"|"xlsx","snag_priority": "low"|"medium"|"high"|"critical","snag_status": "open"|"in_progress"|"ready_for_review"|"closed"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"storage": {
          Tables: {
            "buckets": {
                  Row: {
                    "allowed_mime_types": (string)[] | null,"avif_autodetection": boolean | null,"created_at": string | null,"file_size_limit": number | null,"id": string,"lifecycle_configuration": Json | null,"lifecycle_configuration_generation": string | null,"name": string,"owner": string | null,"owner_id": string | null,"public": boolean | null,"type": Database["storage"]['Enums']["buckettype"],"updated_at": string | null,"versioning_status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "allowed_mime_types"?: (string)[] | null,"avif_autodetection"?: boolean | null,"created_at"?: string | null,"file_size_limit"?: number | null,"id": string,"lifecycle_configuration"?: Json | null,"lifecycle_configuration_generation"?: string | null,"name": string,"owner"?: string | null,"owner_id"?: string | null,"public"?: boolean | null,"type"?: Database["storage"]['Enums']["buckettype"],"updated_at"?: string | null,"versioning_status"?: string
                  }
                  Update: {
                    "allowed_mime_types"?: (string)[] | null,"avif_autodetection"?: boolean | null,"created_at"?: string | null,"file_size_limit"?: number | null,"id"?: string,"lifecycle_configuration"?: Json | null,"lifecycle_configuration_generation"?: string | null,"name"?: string,"owner"?: string | null,"owner_id"?: string | null,"public"?: boolean | null,"type"?: Database["storage"]['Enums']["buckettype"],"updated_at"?: string | null,"versioning_status"?: string
                  }
                  Relationships: [
                    
                  ]
                },"buckets_analytics": {
                  Row: {
                    "created_at": string,"deleted_at": string | null,"format": string,"id": string,"name": string,"type": Database["storage"]['Enums']["buckettype"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"deleted_at"?: string | null,"format"?: string,"id"?: string,"name": string,"type"?: Database["storage"]['Enums']["buckettype"],"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"deleted_at"?: string | null,"format"?: string,"id"?: string,"name"?: string,"type"?: Database["storage"]['Enums']["buckettype"],"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"buckets_vectors": {
                  Row: {
                    "created_at": string,"id": string,"type": Database["storage"]['Enums']["buckettype"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id": string,"type"?: Database["storage"]['Enums']["buckettype"],"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"type"?: Database["storage"]['Enums']["buckettype"],"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"iceberg_namespaces": {
                  Row: {
                    "bucket_name": string,"catalog_id": string,"created_at": string,"id": string,"metadata": NonNullable<Json>,"name": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "bucket_name": string,"catalog_id": string,"created_at"?: string,"id"?: string,"metadata"?: NonNullable<Json>,"name": string,"updated_at"?: string
                  }
                  Update: {
                    "bucket_name"?: string,"catalog_id"?: string,"created_at"?: string,"id"?: string,"metadata"?: NonNullable<Json>,"name"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "iceberg_namespaces_catalog_id_fkey"
      columns: ["catalog_id"]
isOneToOne: false
      referencedRelation: "buckets_analytics"
      referencedColumns: ["id"]
    }
                  ]
                },"iceberg_tables": {
                  Row: {
                    "bucket_name": string,"catalog_id": string,"created_at": string,"id": string,"location": string,"name": string,"namespace_id": string,"remote_table_id": string | null,"shard_id": string | null,"shard_key": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "bucket_name": string,"catalog_id": string,"created_at"?: string,"id"?: string,"location": string,"name": string,"namespace_id": string,"remote_table_id"?: string | null,"shard_id"?: string | null,"shard_key"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "bucket_name"?: string,"catalog_id"?: string,"created_at"?: string,"id"?: string,"location"?: string,"name"?: string,"namespace_id"?: string,"remote_table_id"?: string | null,"shard_id"?: string | null,"shard_key"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "iceberg_tables_catalog_id_fkey"
      columns: ["catalog_id"]
isOneToOne: false
      referencedRelation: "buckets_analytics"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "iceberg_tables_namespace_id_fkey"
      columns: ["namespace_id"]
isOneToOne: false
      referencedRelation: "iceberg_namespaces"
      referencedColumns: ["id"]
    }
                  ]
                },"migrations": {
                  Row: {
                    "executed_at": string | null,"hash": string,"id": number,"name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "executed_at"?: string | null,"hash": string,"id": number,"name": string
                  }
                  Update: {
                    "executed_at"?: string | null,"hash"?: string,"id"?: number,"name"?: string
                  }
                  Relationships: [
                    
                  ]
                },"objects": {
                  Row: {
                    "archived_at": string | null,"bucket_id": string | null,"created_at": string | null,"id": string,"is_delete_marker": boolean,"is_versioned": boolean,"last_accessed_at": string | null,"metadata": Json | null,"name": string | null,"owner": string | null,"owner_id": string | null,"path_tokens": (string)[] | null,"updated_at": string | null,"user_metadata": Json | null,"version": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: string | null,"bucket_id"?: string | null,"created_at"?: string | null,"id"?: string,"is_delete_marker"?: boolean,"is_versioned"?: boolean,"last_accessed_at"?: string | null,"metadata"?: Json | null,"name"?: string | null,"owner"?: string | null,"owner_id"?: string | null,"path_tokens"?: never,"updated_at"?: string | null,"user_metadata"?: Json | null,"version"?: string | null
                  }
                  Update: {
                    "archived_at"?: string | null,"bucket_id"?: string | null,"created_at"?: string | null,"id"?: string,"is_delete_marker"?: boolean,"is_versioned"?: boolean,"last_accessed_at"?: string | null,"metadata"?: Json | null,"name"?: string | null,"owner"?: string | null,"owner_id"?: string | null,"path_tokens"?: never,"updated_at"?: string | null,"user_metadata"?: Json | null,"version"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "objects_bucketId_fkey"
      columns: ["bucket_id"]
isOneToOne: false
      referencedRelation: "buckets"
      referencedColumns: ["id"]
    }
                  ]
                },"s3_multipart_uploads": {
                  Row: {
                    "bucket_id": string,"created_at": string,"id": string,"in_progress_size": number,"key": string,"metadata": Json | null,"owner_id": string | null,"upload_signature": string,"user_metadata": Json | null,"version": string
                  }
                  ComputedFields: never
                  Insert: {
                    "bucket_id": string,"created_at"?: string,"id": string,"in_progress_size"?: number,"key": string,"metadata"?: Json | null,"owner_id"?: string | null,"upload_signature": string,"user_metadata"?: Json | null,"version": string
                  }
                  Update: {
                    "bucket_id"?: string,"created_at"?: string,"id"?: string,"in_progress_size"?: number,"key"?: string,"metadata"?: Json | null,"owner_id"?: string | null,"upload_signature"?: string,"user_metadata"?: Json | null,"version"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "s3_multipart_uploads_bucket_id_fkey"
      columns: ["bucket_id"]
isOneToOne: false
      referencedRelation: "buckets"
      referencedColumns: ["id"]
    }
                  ]
                },"s3_multipart_uploads_parts": {
                  Row: {
                    "bucket_id": string,"created_at": string,"etag": string,"id": string,"key": string,"owner_id": string | null,"part_number": number,"size": number,"upload_id": string,"version": string
                  }
                  ComputedFields: never
                  Insert: {
                    "bucket_id": string,"created_at"?: string,"etag": string,"id"?: string,"key": string,"owner_id"?: string | null,"part_number": number,"size"?: number,"upload_id": string,"version": string
                  }
                  Update: {
                    "bucket_id"?: string,"created_at"?: string,"etag"?: string,"id"?: string,"key"?: string,"owner_id"?: string | null,"part_number"?: number,"size"?: number,"upload_id"?: string,"version"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "s3_multipart_uploads_parts_bucket_id_fkey"
      columns: ["bucket_id"]
isOneToOne: false
      referencedRelation: "buckets"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "s3_multipart_uploads_parts_upload_id_fkey"
      columns: ["upload_id"]
isOneToOne: false
      referencedRelation: "s3_multipart_uploads"
      referencedColumns: ["id"]
    }
                  ]
                },"vector_indexes": {
                  Row: {
                    "bucket_id": string,"created_at": string,"data_type": string,"dimension": number,"distance_metric": string,"id": string,"metadata_configuration": Json | null,"name": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "bucket_id": string,"created_at"?: string,"data_type": string,"dimension": number,"distance_metric": string,"id"?: string,"metadata_configuration"?: Json | null,"name": string,"updated_at"?: string
                  }
                  Update: {
                    "bucket_id"?: string,"created_at"?: string,"data_type"?: string,"dimension"?: number,"distance_metric"?: string,"id"?: string,"metadata_configuration"?: Json | null,"name"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "vector_indexes_bucket_id_fkey"
      columns: ["bucket_id"]
isOneToOne: false
      referencedRelation: "buckets_vectors"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "allow_any_operation":
{ Args: { "expected_operations": (string)[] }; Returns: boolean
                           },
"allow_only_operation":
{ Args: { "expected_operation": string }; Returns: boolean
                           },
"can_insert_object":
{ Args: { "bucketid": string,"metadata": Json,"name": string,"owner": string }; Returns: undefined
                           },
"extension":
{ Args: { "name": string }; Returns: string
                           },
"filename":
{ Args: { "name": string }; Returns: string
                           },
"foldername":
{ Args: { "name": string }; Returns: (string)[]
                           },
"get_common_prefix":
{ Args: { "p_delimiter": string,"p_key": string,"p_prefix": string }; Returns: string
                           },
"get_size_by_bucket":
{ Args: { "delete_markers"?: string,"noncurrent_versions"?: string }; Returns: {
              "bucket_id": string,"size": number
            }[]
                           },
"list_multipart_uploads_with_delimiter":
{ Args: { "bucket_id": string,"delimiter_param": string,"max_keys"?: number,"next_key_token"?: string,"next_upload_token"?: string,"prefix_param": string,"raw_prefix_param"?: string }; Returns: {
              "created_at": string,"id": string,"key": string
            }[]
                           },
"list_objects_with_delimiter":
{ Args: { "_bucket_id": string,"delete_markers"?: string,"delimiter_param": string,"max_keys"?: number,"next_token"?: string,"next_token_archived_at"?: string,"next_token_version"?: string,"noncurrent_versions"?: string,"prefix_param": string,"sort_order"?: string,"start_after"?: string }; Returns: {
              "archived_at": string,"created_at": string,"id": string,"is_delete_marker": boolean,"is_versioned": boolean,"last_accessed_at": string,"metadata": Json,"name": string,"updated_at": string,"version": string
            }[]
                           },
"operation":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"search":
{ Args: { "bucketname": string,"delete_markers"?: string,"levels"?: number,"limits"?: number,"noncurrent_versions"?: string,"offsets"?: number,"prefix": string,"search"?: string,"sortcolumn"?: string,"sortorder"?: string }; Returns: {
              "archived_at": string,"created_at": string,"id": string,"is_delete_marker": boolean,"is_versioned": boolean,"last_accessed_at": string,"metadata": Json,"name": string,"updated_at": string,"version": string
            }[]
                           },
"search_by_timestamp":
{ Args: { "delete_markers"?: string,"noncurrent_versions"?: string,"p_bucket_id": string,"p_level": number,"p_limit": number,"p_prefix": string,"p_sort_column": string,"p_sort_column_after": string,"p_sort_order": string,"p_start_after": string,"p_start_after_version"?: string }; Returns: {
              "archived_at": string,"created_at": string,"id": string,"is_delete_marker": boolean,"is_versioned": boolean,"key": string,"last_accessed_at": string,"metadata": Json,"name": string,"updated_at": string,"version": string
            }[]
                           },
"search_v2":
{ Args: { "bucket_name": string,"delete_markers"?: string,"levels"?: number,"limits"?: number,"noncurrent_versions"?: string,"prefix": string,"sort_column"?: string,"sort_column_after"?: string,"sort_order"?: string,"start_after"?: string,"start_after_archived_at"?: string,"start_after_is_continuation"?: boolean,"start_after_version"?: string }; Returns: {
              "archived_at": string,"created_at": string,"id": string,"is_delete_marker": boolean,"is_versioned": boolean,"key": string,"last_accessed_at": string,"metadata": Json,"name": string,"updated_at": string,"version": string
            }[]
                           }
          }
          Enums: {
            "buckettype": "STANDARD"|"ANALYTICS"|"VECTOR"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "photo_kind": ["issue", "fix"],"project_role": ["manager", "member", "viewer"],"project_state": ["active", "archived"],"report_format": ["pdf", "xlsx"],"snag_priority": ["low", "medium", "high", "critical"],"snag_status": ["open", "in_progress", "ready_for_review", "closed"]
          }
        },"storage": {
          Enums: {
            "buckettype": ["STANDARD", "ANALYTICS", "VECTOR"]
          }
        }
} as const
