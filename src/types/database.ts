
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
            "account_private": {
                  Row: {
                    "birthday": string,"created_at": string,"terms_accepted_at": string,"user_id": string
                  }
                  Insert: {
                    "birthday": string,"created_at"?: string,"terms_accepted_at": string,"user_id": string
                  }
                  Update: {
                    "birthday"?: string,"created_at"?: string,"terms_accepted_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"audio_tracks": {
                  Row: {
                    "artist": string,"audio_path": string,"cover_color": string,"created_at": string,"duration_ms": number,"id": string,"license": string,"source": string,"title": string
                  }
                  Insert: {
                    "artist": string,"audio_path": string,"cover_color"?: string,"created_at"?: string,"duration_ms": number,"id"?: string,"license"?: string,"source"?: string,"title": string
                  }
                  Update: {
                    "artist"?: string,"audio_path"?: string,"cover_color"?: string,"created_at"?: string,"duration_ms"?: number,"id"?: string,"license"?: string,"source"?: string,"title"?: string
                  }
                  Relationships: [
                    
                  ]
                },"close_friends": {
                  Row: {
                    "created_at": string,"friend_id": string,"owner_id": string
                  }
                  Insert: {
                    "created_at"?: string,"friend_id": string,"owner_id"?: string
                  }
                  Update: {
                    "created_at"?: string,"friend_id"?: string,"owner_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "close_friends_friend_id_fkey"
      columns: ["friend_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "close_friends_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"contact_hashes": {
                  Row: {
                    "created_at": string,"hash": string,"owner_id": string
                  }
                  Insert: {
                    "created_at"?: string,"hash": string,"owner_id"?: string
                  }
                  Update: {
                    "created_at"?: string,"hash"?: string,"owner_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"favorites": {
                  Row: {
                    "created_at": string,"favorite_id": string,"owner_id": string
                  }
                  Insert: {
                    "created_at"?: string,"favorite_id": string,"owner_id"?: string
                  }
                  Update: {
                    "created_at"?: string,"favorite_id"?: string,"owner_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "favorites_favorite_id_fkey"
      columns: ["favorite_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "favorites_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"follow_requests": {
                  Row: {
                    "created_at": string,"requester_id": string,"target_id": string
                  }
                  Insert: {
                    "created_at"?: string,"requester_id": string,"target_id": string
                  }
                  Update: {
                    "created_at"?: string,"requester_id"?: string,"target_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "follow_requests_requester_id_fkey"
      columns: ["requester_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "follow_requests_target_id_fkey"
      columns: ["target_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"follows": {
                  Row: {
                    "created_at": string,"follower_id": string,"following_id": string
                  }
                  Insert: {
                    "created_at"?: string,"follower_id": string,"following_id": string
                  }
                  Update: {
                    "created_at"?: string,"follower_id"?: string,"following_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "follows_follower_id_fkey"
      columns: ["follower_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "follows_following_id_fkey"
      columns: ["following_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"hashtags": {
                  Row: {
                    "created_at": string,"id": string,"name": string,"post_count": number
                  }
                  Insert: {
                    "created_at"?: string,"id"?: string,"name": string,"post_count"?: number
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"name"?: string,"post_count"?: number
                  }
                  Relationships: [
                    
                  ]
                },"highlights": {
                  Row: {
                    "cover_path": string | null,"created_at": string,"id": string,"owner_id": string,"position": number,"title": string,"updated_at": string
                  }
                  Insert: {
                    "cover_path"?: string | null,"created_at"?: string,"id"?: string,"owner_id"?: string,"position"?: number,"title"?: string,"updated_at"?: string
                  }
                  Update: {
                    "cover_path"?: string | null,"created_at"?: string,"id"?: string,"owner_id"?: string,"position"?: number,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "highlights_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"post_collaborators": {
                  Row: {
                    "invited_at": string,"post_id": string,"responded_at": string | null,"status": string,"user_id": string
                  }
                  Insert: {
                    "invited_at"?: string,"post_id": string,"responded_at"?: string | null,"status"?: string,"user_id": string
                  }
                  Update: {
                    "invited_at"?: string,"post_id"?: string,"responded_at"?: string | null,"status"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "post_collaborators_post_id_fkey"
      columns: ["post_id"]
isOneToOne: false
      referencedRelation: "posts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "post_collaborators_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"post_hashtags": {
                  Row: {
                    "hashtag_id": string,"post_id": string
                  }
                  Insert: {
                    "hashtag_id": string,"post_id": string
                  }
                  Update: {
                    "hashtag_id"?: string,"post_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "post_hashtags_hashtag_id_fkey"
      columns: ["hashtag_id"]
isOneToOne: false
      referencedRelation: "hashtags"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "post_hashtags_post_id_fkey"
      columns: ["post_id"]
isOneToOne: false
      referencedRelation: "posts"
      referencedColumns: ["id"]
    }
                  ]
                },"post_media": {
                  Row: {
                    "alt_text": string | null,"author_id": string,"created_at": string,"duration_ms": number | null,"height": number,"id": string,"path": string,"position": number,"post_id": string,"thumb_path": string | null,"type": string,"width": number
                  }
                  Insert: {
                    "alt_text"?: string | null,"author_id"?: string,"created_at"?: string,"duration_ms"?: number | null,"height": number,"id"?: string,"path": string,"position": number,"post_id": string,"thumb_path"?: string | null,"type": string,"width": number
                  }
                  Update: {
                    "alt_text"?: string | null,"author_id"?: string,"created_at"?: string,"duration_ms"?: number | null,"height"?: number,"id"?: string,"path"?: string,"position"?: number,"post_id"?: string,"thumb_path"?: string | null,"type"?: string,"width"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "post_media_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "post_media_post_id_fkey"
      columns: ["post_id"]
isOneToOne: false
      referencedRelation: "posts"
      referencedColumns: ["id"]
    }
                  ]
                },"post_mentions": {
                  Row: {
                    "created_at": string,"post_id": string,"user_id": string
                  }
                  Insert: {
                    "created_at"?: string,"post_id": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"post_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "post_mentions_post_id_fkey"
      columns: ["post_id"]
isOneToOne: false
      referencedRelation: "posts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "post_mentions_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"post_tags": {
                  Row: {
                    "created_at": string,"id": string,"media_id": string,"post_id": string,"tagged_user_id": string,"x": number | null,"y": number | null
                  }
                  Insert: {
                    "created_at"?: string,"id"?: string,"media_id": string,"post_id": string,"tagged_user_id": string,"x"?: number | null,"y"?: number | null
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"media_id"?: string,"post_id"?: string,"tagged_user_id"?: string,"x"?: number | null,"y"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "post_tags_media_id_fkey"
      columns: ["media_id"]
isOneToOne: false
      referencedRelation: "post_media"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "post_tags_post_id_fkey"
      columns: ["post_id"]
isOneToOne: false
      referencedRelation: "posts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "post_tags_tagged_user_id_fkey"
      columns: ["tagged_user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"posts": {
                  Row: {
                    "archived_at": string | null,"aspect_ratio": number,"audience": string,"audio_start_ms": number,"audio_track_id": string | null,"author_id": string,"caption": string,"comments_disabled": boolean,"created_at": string,"edited_at": string | null,"hide_like_counts": boolean,"id": string,"pinned_at": string | null,"published_at": string | null,"status": string,"updated_at": string
                  }
                  Insert: {
                    "archived_at"?: string | null,"aspect_ratio"?: number,"audience"?: string,"audio_start_ms"?: number,"audio_track_id"?: string | null,"author_id"?: string,"caption"?: string,"comments_disabled"?: boolean,"created_at"?: string,"edited_at"?: string | null,"hide_like_counts"?: boolean,"id"?: string,"pinned_at"?: string | null,"published_at"?: string | null,"status"?: string,"updated_at"?: string
                  }
                  Update: {
                    "archived_at"?: string | null,"aspect_ratio"?: number,"audience"?: string,"audio_start_ms"?: number,"audio_track_id"?: string | null,"author_id"?: string,"caption"?: string,"comments_disabled"?: boolean,"created_at"?: string,"edited_at"?: string | null,"hide_like_counts"?: boolean,"id"?: string,"pinned_at"?: string | null,"published_at"?: string | null,"status"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "posts_audio_track_id_fkey"
      columns: ["audio_track_id"]
isOneToOne: false
      referencedRelation: "audio_tracks"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "posts_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"profile_notification_prefs": {
                  Row: {
                    "live": boolean,"owner_id": string,"posts": boolean,"reels": boolean,"stories": boolean,"target_id": string,"updated_at": string
                  }
                  Insert: {
                    "live"?: boolean,"owner_id"?: string,"posts"?: boolean,"reels"?: boolean,"stories"?: boolean,"target_id": string,"updated_at"?: string
                  }
                  Update: {
                    "live"?: boolean,"owner_id"?: string,"posts"?: boolean,"reels"?: boolean,"stories"?: boolean,"target_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "profile_notification_prefs_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "profile_notification_prefs_target_id_fkey"
      columns: ["target_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "avatar_path": string | null,"bio": string,"created_at": string,"followers_count": number,"following_count": number,"full_name": string,"id": string,"is_private": boolean,"links": NonNullable<Json>,"posts_count": number,"updated_at": string,"username": string
                  }
                  Insert: {
                    "avatar_path"?: string | null,"bio"?: string,"created_at"?: string,"followers_count"?: number,"following_count"?: number,"full_name"?: string,"id": string,"is_private"?: boolean,"links"?: NonNullable<Json>,"posts_count"?: number,"updated_at"?: string,"username": string
                  }
                  Update: {
                    "avatar_path"?: string | null,"bio"?: string,"created_at"?: string,"followers_count"?: number,"following_count"?: number,"full_name"?: string,"id"?: string,"is_private"?: boolean,"links"?: NonNullable<Json>,"posts_count"?: number,"updated_at"?: string,"username"?: string
                  }
                  Relationships: [
                    
                  ]
                },"saved_audio": {
                  Row: {
                    "created_at": string,"track_id": string,"user_id": string
                  }
                  Insert: {
                    "created_at"?: string,"track_id": string,"user_id"?: string
                  }
                  Update: {
                    "created_at"?: string,"track_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "saved_audio_track_id_fkey"
      columns: ["track_id"]
isOneToOne: false
      referencedRelation: "audio_tracks"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "saved_audio_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"saved_collection_items": {
                  Row: {
                    "collection_id": string,"created_at": string,"post_id": string
                  }
                  Insert: {
                    "collection_id": string,"created_at"?: string,"post_id": string
                  }
                  Update: {
                    "collection_id"?: string,"created_at"?: string,"post_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "saved_collection_items_collection_id_fkey"
      columns: ["collection_id"]
isOneToOne: false
      referencedRelation: "saved_collections"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "saved_collection_items_post_fk"
      columns: ["post_id"]
isOneToOne: false
      referencedRelation: "posts"
      referencedColumns: ["id"]
    }
                  ]
                },"saved_collections": {
                  Row: {
                    "cover_post_id": string | null,"created_at": string,"id": string,"name": string,"owner_id": string,"updated_at": string
                  }
                  Insert: {
                    "cover_post_id"?: string | null,"created_at"?: string,"id"?: string,"name": string,"owner_id"?: string,"updated_at"?: string
                  }
                  Update: {
                    "cover_post_id"?: string | null,"created_at"?: string,"id"?: string,"name"?: string,"owner_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "saved_collections_cover_post_fk"
      columns: ["cover_post_id"]
isOneToOne: false
      referencedRelation: "posts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "saved_collections_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"username_changes": {
                  Row: {
                    "changed_at": string,"id": string,"new_username": string,"old_username": string,"user_id": string
                  }
                  Insert: {
                    "changed_at"?: string,"id"?: string,"new_username": string,"old_username": string,"user_id": string
                  }
                  Update: {
                    "changed_at"?: string,"id"?: string,"new_username"?: string,"old_username"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "username_changes_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "account_about":
{ Args: { "p_user_id": string }; Returns: {
              "avatar_path": string,"date_joined": string,"former_usernames_count": number,"id": string,"username": string
            }[]
                           },
"approve_follow_request":
{ Args: { "requester": string }; Returns: boolean
                           },
"auth_lookup":
{ Args: { "identifier": string }; Returns: {
              "email": string,"has_profile": boolean,"user_id": string,"username": string
            }[]
                           },
"can_view_post":
{ Args: { "p_post": string }; Returns: boolean
                           },
"can_view_post_object":
{ Args: { "object_name": string }; Returns: boolean
                           },
"can_view_profile":
{ Args: { "target": string }; Returns: boolean
                           },
"complete_signup":
{ Args: { "p_birthday": string,"p_full_name": string,"p_username": string }; Returns: {
              "avatar_path": string | null,
"bio": string,
"created_at": string,
"followers_count": number,
"following_count": number,
"full_name": string,
"id": string,
"is_private": boolean,
"links": NonNullable<Json>,
"posts_count": number,
"updated_at": string,
"username": string
            }
                          SetofOptions: {
        from: "*"
        to: "profiles"
        isOneToOne: true
        isSetofReturn: false
      } },
"follow_user":
{ Args: { "target": string }; Returns: string
                           },
"get_profile":
{ Args: { "p_user_id"?: string,"p_username"?: string }; Returns: {
              "avatar_path": string,"bio": string,"can_view": boolean,"created_at": string,"followers_count": number,"following_count": number,"follows_me": boolean,"full_name": string,"i_follow": boolean,"id": string,"is_close_friend": boolean,"is_favorite": boolean,"is_private": boolean,"is_self": boolean,"links": Json,"mutual_count": number,"mutual_preview": Json,"posts_count": number,"requested": boolean,"username": string
            }[]
                           },
"is_valid_caption":
{ Args: { "caption": string }; Returns: boolean
                           },
"is_valid_profile_links":
{ Args: { "links": Json }; Returns: boolean
                           },
"is_valid_username":
{ Args: { "name": string }; Returns: boolean
                           },
"my_collab_invites":
{ Args: Record<PropertyKey, never>; Returns: {
              "author_avatar_path": string,"author_id": string,"author_username": string,"cover_path": string,"invited_at": string,"post_id": string
            }[]
                           },
"people_picker":
{ Args: { "p_limit"?: number,"p_search"?: string }; Returns: {
              "avatar_path": string,"full_name": string,"i_follow": boolean,"id": string,"is_close_friend": boolean,"is_favorite": boolean,"username": string
            }[]
                           },
"profile_connections":
{ Args: { "p_kind": string,"p_limit"?: number,"p_offset"?: number,"p_search"?: string,"p_user_id": string }; Returns: {
              "avatar_path": string,"followed_at": string,"follows_me": boolean,"full_name": string,"i_follow": boolean,"id": string,"is_private": boolean,"is_self": boolean,"requested": boolean,"username": string
            }[]
                           },
"profile_posts":
{ Args: { "p_kind"?: string,"p_limit"?: number,"p_offset"?: number,"p_user": string }; Returns: {
              "archived_at": string,"audience": string,"author_id": string,"cover_path": string,"cover_type": string,"id": string,"is_pinned": boolean,"media_count": number,"published_at": string
            }[]
                           },
"publish_post":
{ Args: { "p_post": string }; Returns: string
                           },
"refresh_posts_count":
{ Args: { "p_user": string }; Returns: undefined
                           },
"reorder_post_media":
{ Args: { "p_media": (string)[],"p_post": string }; Returns: undefined
                           },
"respond_collab_invite":
{ Args: { "p_accept": boolean,"p_post": string }; Returns: boolean
                           },
"search_profiles":
{ Args: { "p_limit"?: number,"p_query": string }; Returns: {
              "avatar_path": string,"full_name": string,"i_follow": boolean,"id": string,"is_private": boolean,"username": string
            }[]
                           },
"suggest_usernames":
{ Args: { "full_name": string,"max_count"?: number }; Returns: (string)[]
                           },
"suggested_accounts":
{ Args: { "max_count"?: number }; Returns: {
              "avatar_path": string,"full_name": string,"id": string,"is_private": boolean,"reason": string,"username": string
            }[]
                           },
"sync_post_caption_refs":
{ Args: { "p_caption": string,"p_post": string }; Returns: undefined
                           },
"unfollow_user":
{ Args: { "target": string }; Returns: undefined
                           },
"username_available":
{ Args: { "name": string }; Returns: boolean
                           }
          }
          Enums: {
            [_ in never]: never
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
            
          }
        }
} as const
