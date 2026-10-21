
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
                },"activity_state": {
                  Row: {
                    "seen_at": string,"user_id": string
                  }
                  Insert: {
                    "seen_at"?: string,"user_id": string
                  }
                  Update: {
                    "seen_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "activity_state_user_id_fkey"
      columns: ["user_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"audio_tracks": {
                  Row: {
                    "artist": string,"audio_path": string | null,"cover_color": string,"created_at": string,"duration_ms": number,"id": string,"license": string,"origin_post_id": string | null,"owner_id": string | null,"renamed_at": string | null,"source": string,"title": string
                  }
                  Insert: {
                    "artist": string,"audio_path"?: string | null,"cover_color"?: string,"created_at"?: string,"duration_ms": number,"id"?: string,"license"?: string,"origin_post_id"?: string | null,"owner_id"?: string | null,"renamed_at"?: string | null,"source"?: string,"title": string
                  }
                  Update: {
                    "artist"?: string,"audio_path"?: string | null,"cover_color"?: string,"created_at"?: string,"duration_ms"?: number,"id"?: string,"license"?: string,"origin_post_id"?: string | null,"owner_id"?: string | null,"renamed_at"?: string | null,"source"?: string,"title"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "audio_tracks_origin_post_id_fkey"
      columns: ["origin_post_id"]
isOneToOne: true
      referencedRelation: "posts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "audio_tracks_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
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
                },"comment_likes": {
                  Row: {
                    "comment_id": string,"created_at": string,"user_id": string
                  }
                  Insert: {
                    "comment_id": string,"created_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "comment_id"?: string,"created_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "comment_likes_comment_id_fkey"
      columns: ["comment_id"]
isOneToOne: false
      referencedRelation: "comments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "comment_likes_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"comments": {
                  Row: {
                    "author_id": string,"body": string,"created_at": string,"hidden_at": string | null,"id": string,"like_count": number,"parent_id": string | null,"pinned_at": string | null,"post_id": string,"reply_count": number
                  }
                  Insert: {
                    "author_id"?: string,"body": string,"created_at"?: string,"hidden_at"?: string | null,"id"?: string,"like_count"?: number,"parent_id"?: string | null,"pinned_at"?: string | null,"post_id": string,"reply_count"?: number
                  }
                  Update: {
                    "author_id"?: string,"body"?: string,"created_at"?: string,"hidden_at"?: string | null,"id"?: string,"like_count"?: number,"parent_id"?: string | null,"pinned_at"?: string | null,"post_id"?: string,"reply_count"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "comments_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "comments_parent_id_fkey"
      columns: ["parent_id"]
isOneToOne: false
      referencedRelation: "comments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "comments_post_id_fkey"
      columns: ["post_id"]
isOneToOne: false
      referencedRelation: "posts"
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
                },"highlight_items": {
                  Row: {
                    "added_at": string,"highlight_id": string,"owner_id": string,"position": number,"story_id": string
                  }
                  Insert: {
                    "added_at"?: string,"highlight_id": string,"owner_id"?: string,"position"?: number,"story_id": string
                  }
                  Update: {
                    "added_at"?: string,"highlight_id"?: string,"owner_id"?: string,"position"?: number,"story_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "highlight_items_highlight_id_fkey"
      columns: ["highlight_id"]
isOneToOne: false
      referencedRelation: "highlights"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "highlight_items_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "highlight_items_story_id_fkey"
      columns: ["story_id"]
isOneToOne: false
      referencedRelation: "stories"
      referencedColumns: ["id"]
    }
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
                },"likes": {
                  Row: {
                    "created_at": string,"post_id": string,"user_id": string
                  }
                  Insert: {
                    "created_at"?: string,"post_id": string,"user_id"?: string
                  }
                  Update: {
                    "created_at"?: string,"post_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "likes_post_id_fkey"
      columns: ["post_id"]
isOneToOne: false
      referencedRelation: "posts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "likes_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"message_reactions": {
                  Row: {
                    "created_at": string,"emoji": string,"message_id": string,"user_id": string
                  }
                  Insert: {
                    "created_at"?: string,"emoji": string,"message_id": string,"user_id"?: string
                  }
                  Update: {
                    "created_at"?: string,"emoji"?: string,"message_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "message_reactions_message_id_fkey"
      columns: ["message_id"]
isOneToOne: false
      referencedRelation: "messages"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "message_reactions_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"message_views": {
                  Row: {
                    "first_viewed_at": string,"last_viewed_at": string,"message_id": string,"screenshot_at": string | null,"user_id": string,"view_count": number
                  }
                  Insert: {
                    "first_viewed_at"?: string,"last_viewed_at"?: string,"message_id": string,"screenshot_at"?: string | null,"user_id": string,"view_count"?: number
                  }
                  Update: {
                    "first_viewed_at"?: string,"last_viewed_at"?: string,"message_id"?: string,"screenshot_at"?: string | null,"user_id"?: string,"view_count"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "message_views_message_id_fkey"
      columns: ["message_id"]
isOneToOne: false
      referencedRelation: "messages"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "message_views_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"messages": {
                  Row: {
                    "audio_id": string | null,"body": string | null,"created_at": string,"data": NonNullable<Json>,"duration_ms": number | null,"edited_at": string | null,"height": number | null,"id": string,"kind": string,"media_path": string | null,"media_type": string | null,"note_id": string | null,"pinned_at": string | null,"pinned_by": string | null,"post_id": string | null,"profile_id": string | null,"reply_to_id": string | null,"scheduled_for": string | null,"sender_id": string,"story_id": string | null,"thread_id": string,"thumb_path": string | null,"vanish": boolean,"view_mode": string,"waveform": Json | null,"width": number | null
                  }
                  Insert: {
                    "audio_id"?: string | null,"body"?: string | null,"created_at"?: string,"data"?: NonNullable<Json>,"duration_ms"?: number | null,"edited_at"?: string | null,"height"?: number | null,"id"?: string,"kind"?: string,"media_path"?: string | null,"media_type"?: string | null,"note_id"?: string | null,"pinned_at"?: string | null,"pinned_by"?: string | null,"post_id"?: string | null,"profile_id"?: string | null,"reply_to_id"?: string | null,"scheduled_for"?: string | null,"sender_id"?: string,"story_id"?: string | null,"thread_id": string,"thumb_path"?: string | null,"vanish"?: boolean,"view_mode"?: string,"waveform"?: Json | null,"width"?: number | null
                  }
                  Update: {
                    "audio_id"?: string | null,"body"?: string | null,"created_at"?: string,"data"?: NonNullable<Json>,"duration_ms"?: number | null,"edited_at"?: string | null,"height"?: number | null,"id"?: string,"kind"?: string,"media_path"?: string | null,"media_type"?: string | null,"note_id"?: string | null,"pinned_at"?: string | null,"pinned_by"?: string | null,"post_id"?: string | null,"profile_id"?: string | null,"reply_to_id"?: string | null,"scheduled_for"?: string | null,"sender_id"?: string,"story_id"?: string | null,"thread_id"?: string,"thumb_path"?: string | null,"vanish"?: boolean,"view_mode"?: string,"waveform"?: Json | null,"width"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "messages_audio_id_fkey"
      columns: ["audio_id"]
isOneToOne: false
      referencedRelation: "audio_tracks"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "messages_note_id_fkey"
      columns: ["note_id"]
isOneToOne: false
      referencedRelation: "notes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "messages_pinned_by_fkey"
      columns: ["pinned_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "messages_post_id_fkey"
      columns: ["post_id"]
isOneToOne: false
      referencedRelation: "posts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "messages_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "messages_reply_to_id_fkey"
      columns: ["reply_to_id"]
isOneToOne: false
      referencedRelation: "messages"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "messages_sender_id_fkey"
      columns: ["sender_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "messages_story_id_fkey"
      columns: ["story_id"]
isOneToOne: false
      referencedRelation: "stories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "messages_thread_id_fkey"
      columns: ["thread_id"]
isOneToOne: false
      referencedRelation: "threads"
      referencedColumns: ["id"]
    }
                  ]
                },"note_likes": {
                  Row: {
                    "created_at": string,"note_id": string,"user_id": string
                  }
                  Insert: {
                    "created_at"?: string,"note_id": string,"user_id"?: string
                  }
                  Update: {
                    "created_at"?: string,"note_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "note_likes_note_id_fkey"
      columns: ["note_id"]
isOneToOne: false
      referencedRelation: "notes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "note_likes_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"notes": {
                  Row: {
                    "audience": string,"audio_start_ms": number,"audio_track_id": string | null,"author_id": string,"body": string | null,"created_at": string,"expires_at": string,"id": string
                  }
                  Insert: {
                    "audience"?: string,"audio_start_ms"?: number,"audio_track_id"?: string | null,"author_id"?: string,"body"?: string | null,"created_at"?: string,"expires_at"?: string,"id"?: string
                  }
                  Update: {
                    "audience"?: string,"audio_start_ms"?: number,"audio_track_id"?: string | null,"author_id"?: string,"body"?: string | null,"created_at"?: string,"expires_at"?: string,"id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notes_audio_track_id_fkey"
      columns: ["audio_track_id"]
isOneToOne: false
      referencedRelation: "audio_tracks"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notes_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"notifications": {
                  Row: {
                    "actor_id": string,"audio_id": string | null,"comment_id": string | null,"created_at": string,"data": NonNullable<Json>,"id": string,"post_id": string | null,"recipient_id": string,"story_id": string | null,"type": string
                  }
                  Insert: {
                    "actor_id": string,"audio_id"?: string | null,"comment_id"?: string | null,"created_at"?: string,"data"?: NonNullable<Json>,"id"?: string,"post_id"?: string | null,"recipient_id": string,"story_id"?: string | null,"type": string
                  }
                  Update: {
                    "actor_id"?: string,"audio_id"?: string | null,"comment_id"?: string | null,"created_at"?: string,"data"?: NonNullable<Json>,"id"?: string,"post_id"?: string | null,"recipient_id"?: string,"story_id"?: string | null,"type"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notifications_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notifications_audio_id_fkey"
      columns: ["audio_id"]
isOneToOne: false
      referencedRelation: "audio_tracks"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notifications_comment_id_fkey"
      columns: ["comment_id"]
isOneToOne: false
      referencedRelation: "comments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notifications_post_id_fkey"
      columns: ["post_id"]
isOneToOne: false
      referencedRelation: "posts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notifications_recipient_id_fkey"
      columns: ["recipient_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notifications_story_id_fkey"
      columns: ["story_id"]
isOneToOne: false
      referencedRelation: "stories"
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
                },"post_hides": {
                  Row: {
                    "created_at": string,"post_id": string,"reason": string,"user_id": string
                  }
                  Insert: {
                    "created_at"?: string,"post_id": string,"reason"?: string,"user_id"?: string
                  }
                  Update: {
                    "created_at"?: string,"post_id"?: string,"reason"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "post_hides_post_id_fkey"
      columns: ["post_id"]
isOneToOne: false
      referencedRelation: "posts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "post_hides_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
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
                },"post_seen": {
                  Row: {
                    "post_id": string,"seen_at": string,"user_id": string
                  }
                  Insert: {
                    "post_id": string,"seen_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "post_id"?: string,"seen_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "post_seen_post_id_fkey"
      columns: ["post_id"]
isOneToOne: false
      referencedRelation: "posts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "post_seen_user_id_fkey"
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
                    "allow_download": boolean,"allow_remix": boolean,"archived_at": string | null,"aspect_ratio": number,"audience": string,"audio_start_ms": number,"audio_track_id": string | null,"author_id": string,"caption": string,"comment_count": number,"comments_disabled": boolean,"cover_offset": number,"cover_path": string | null,"created_at": string,"edited_at": string | null,"hide_like_counts": boolean,"id": string,"kind": string,"like_count": number,"linked_reel_id": string | null,"pinned_at": string | null,"play_count": number,"published_at": string | null,"reel": Json | null,"remix_layout": string | null,"remix_of": string | null,"repost_count": number,"status": string,"updated_at": string
                  }
                  Insert: {
                    "allow_download"?: boolean,"allow_remix"?: boolean,"archived_at"?: string | null,"aspect_ratio"?: number,"audience"?: string,"audio_start_ms"?: number,"audio_track_id"?: string | null,"author_id"?: string,"caption"?: string,"comment_count"?: number,"comments_disabled"?: boolean,"cover_offset"?: number,"cover_path"?: string | null,"created_at"?: string,"edited_at"?: string | null,"hide_like_counts"?: boolean,"id"?: string,"kind"?: string,"like_count"?: number,"linked_reel_id"?: string | null,"pinned_at"?: string | null,"play_count"?: number,"published_at"?: string | null,"reel"?: Json | null,"remix_layout"?: string | null,"remix_of"?: string | null,"repost_count"?: number,"status"?: string,"updated_at"?: string
                  }
                  Update: {
                    "allow_download"?: boolean,"allow_remix"?: boolean,"archived_at"?: string | null,"aspect_ratio"?: number,"audience"?: string,"audio_start_ms"?: number,"audio_track_id"?: string | null,"author_id"?: string,"caption"?: string,"comment_count"?: number,"comments_disabled"?: boolean,"cover_offset"?: number,"cover_path"?: string | null,"created_at"?: string,"edited_at"?: string | null,"hide_like_counts"?: boolean,"id"?: string,"kind"?: string,"like_count"?: number,"linked_reel_id"?: string | null,"pinned_at"?: string | null,"play_count"?: number,"published_at"?: string | null,"reel"?: Json | null,"remix_layout"?: string | null,"remix_of"?: string | null,"repost_count"?: number,"status"?: string,"updated_at"?: string
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
    },{
      foreignKeyName: "posts_linked_reel_id_fkey"
      columns: ["linked_reel_id"]
isOneToOne: false
      referencedRelation: "posts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "posts_remix_of_fkey"
      columns: ["remix_of"]
isOneToOne: false
      referencedRelation: "posts"
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
                },"reel_plays": {
                  Row: {
                    "first_played_at": string,"last_played_at": string,"plays": number,"post_id": string,"user_id": string
                  }
                  Insert: {
                    "first_played_at"?: string,"last_played_at"?: string,"plays"?: number,"post_id": string,"user_id"?: string
                  }
                  Update: {
                    "first_played_at"?: string,"last_played_at"?: string,"plays"?: number,"post_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "reel_plays_post_id_fkey"
      columns: ["post_id"]
isOneToOne: false
      referencedRelation: "posts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reel_plays_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"reports": {
                  Row: {
                    "created_at": string,"id": string,"reason": string,"reporter_id": string,"status": string,"sub_reason": string | null,"target_id": string,"target_type": string
                  }
                  Insert: {
                    "created_at"?: string,"id"?: string,"reason": string,"reporter_id"?: string,"status"?: string,"sub_reason"?: string | null,"target_id": string,"target_type": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"reason"?: string,"reporter_id"?: string,"status"?: string,"sub_reason"?: string | null,"target_id"?: string,"target_type"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "reports_reporter_id_fkey"
      columns: ["reporter_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"reposts": {
                  Row: {
                    "created_at": string,"note": string | null,"post_id": string,"user_id": string
                  }
                  Insert: {
                    "created_at"?: string,"note"?: string | null,"post_id": string,"user_id"?: string
                  }
                  Update: {
                    "created_at"?: string,"note"?: string | null,"post_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "reposts_post_id_fkey"
      columns: ["post_id"]
isOneToOne: false
      referencedRelation: "posts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reposts_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
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
                },"saves": {
                  Row: {
                    "created_at": string,"post_id": string,"user_id": string
                  }
                  Insert: {
                    "created_at"?: string,"post_id": string,"user_id"?: string
                  }
                  Update: {
                    "created_at"?: string,"post_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "saves_post_id_fkey"
      columns: ["post_id"]
isOneToOne: false
      referencedRelation: "posts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "saves_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"search_history": {
                  Row: {
                    "id": string,"kind": string,"query": string | null,"searched_at": string,"target_id": string | null,"user_id": string
                  }
                  Insert: {
                    "id"?: string,"kind": string,"query"?: string | null,"searched_at"?: string,"target_id"?: string | null,"user_id"?: string
                  }
                  Update: {
                    "id"?: string,"kind"?: string,"query"?: string | null,"searched_at"?: string,"target_id"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "search_history_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"stories": {
                  Row: {
                    "audience": string,"audio_start_ms": number,"audio_track_id": string | null,"author_id": string,"content": NonNullable<Json>,"created_at": string,"duration_ms": number | null,"files": (string)[],"height": number | null,"id": string,"keep_in_archive": boolean,"kind": string,"like_count": number,"media_path": string | null,"published_at": string | null,"reply_count": number,"reshared_post_id": string | null,"status": string,"thumb_path": string | null,"view_count": number,"width": number | null
                  }
                  Insert: {
                    "audience"?: string,"audio_start_ms"?: number,"audio_track_id"?: string | null,"author_id"?: string,"content"?: NonNullable<Json>,"created_at"?: string,"duration_ms"?: number | null,"files"?: (string)[],"height"?: number | null,"id"?: string,"keep_in_archive"?: boolean,"kind": string,"like_count"?: number,"media_path"?: string | null,"published_at"?: string | null,"reply_count"?: number,"reshared_post_id"?: string | null,"status"?: string,"thumb_path"?: string | null,"view_count"?: number,"width"?: number | null
                  }
                  Update: {
                    "audience"?: string,"audio_start_ms"?: number,"audio_track_id"?: string | null,"author_id"?: string,"content"?: NonNullable<Json>,"created_at"?: string,"duration_ms"?: number | null,"files"?: (string)[],"height"?: number | null,"id"?: string,"keep_in_archive"?: boolean,"kind"?: string,"like_count"?: number,"media_path"?: string | null,"published_at"?: string | null,"reply_count"?: number,"reshared_post_id"?: string | null,"status"?: string,"thumb_path"?: string | null,"view_count"?: number,"width"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "stories_audio_track_id_fkey"
      columns: ["audio_track_id"]
isOneToOne: false
      referencedRelation: "audio_tracks"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "stories_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "stories_reshared_post_id_fkey"
      columns: ["reshared_post_id"]
isOneToOne: false
      referencedRelation: "posts"
      referencedColumns: ["id"]
    }
                  ]
                },"story_hidden_from": {
                  Row: {
                    "created_at": string,"hidden_id": string,"owner_id": string
                  }
                  Insert: {
                    "created_at"?: string,"hidden_id": string,"owner_id"?: string
                  }
                  Update: {
                    "created_at"?: string,"hidden_id"?: string,"owner_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "story_hidden_from_hidden_id_fkey"
      columns: ["hidden_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "story_hidden_from_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"story_likes": {
                  Row: {
                    "created_at": string,"story_id": string,"user_id": string
                  }
                  Insert: {
                    "created_at"?: string,"story_id": string,"user_id"?: string
                  }
                  Update: {
                    "created_at"?: string,"story_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "story_likes_story_id_fkey"
      columns: ["story_id"]
isOneToOne: false
      referencedRelation: "stories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "story_likes_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"story_mentions": {
                  Row: {
                    "author_id": string,"created_at": string,"story_id": string,"user_id": string
                  }
                  Insert: {
                    "author_id"?: string,"created_at"?: string,"story_id": string,"user_id": string
                  }
                  Update: {
                    "author_id"?: string,"created_at"?: string,"story_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "story_mentions_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "story_mentions_story_id_fkey"
      columns: ["story_id"]
isOneToOne: false
      referencedRelation: "stories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "story_mentions_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"story_replies": {
                  Row: {
                    "body": string,"created_at": string,"id": string,"is_reaction": boolean,"sender_id": string,"story_id": string
                  }
                  Insert: {
                    "body": string,"created_at"?: string,"id"?: string,"is_reaction"?: boolean,"sender_id"?: string,"story_id": string
                  }
                  Update: {
                    "body"?: string,"created_at"?: string,"id"?: string,"is_reaction"?: boolean,"sender_id"?: string,"story_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "story_replies_sender_id_fkey"
      columns: ["sender_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "story_replies_story_id_fkey"
      columns: ["story_id"]
isOneToOne: false
      referencedRelation: "stories"
      referencedColumns: ["id"]
    }
                  ]
                },"story_settings": {
                  Row: {
                    "allow_resharing": boolean,"replies": string,"save_to_archive": boolean,"updated_at": string,"user_id": string
                  }
                  Insert: {
                    "allow_resharing"?: boolean,"replies"?: string,"save_to_archive"?: boolean,"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "allow_resharing"?: boolean,"replies"?: string,"save_to_archive"?: boolean,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "story_settings_user_id_fkey"
      columns: ["user_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"story_sticker_responses": {
                  Row: {
                    "body": string | null,"created_at": string,"id": string,"option": number | null,"sticker_id": string,"story_id": string,"type": string,"user_id": string,"value": number | null
                  }
                  Insert: {
                    "body"?: string | null,"created_at"?: string,"id"?: string,"option"?: number | null,"sticker_id": string,"story_id": string,"type": string,"user_id"?: string,"value"?: number | null
                  }
                  Update: {
                    "body"?: string | null,"created_at"?: string,"id"?: string,"option"?: number | null,"sticker_id"?: string,"story_id"?: string,"type"?: string,"user_id"?: string,"value"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "story_sticker_responses_sticker_id_fkey"
      columns: ["sticker_id"]
isOneToOne: false
      referencedRelation: "story_stickers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "story_sticker_responses_story_id_fkey"
      columns: ["story_id"]
isOneToOne: false
      referencedRelation: "stories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "story_sticker_responses_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"story_stickers": {
                  Row: {
                    "author_id": string,"chain_id": string | null,"correct_option": number | null,"created_at": string,"data": NonNullable<Json>,"id": string,"story_id": string,"type": string
                  }
                  Insert: {
                    "author_id"?: string,"chain_id"?: string | null,"correct_option"?: number | null,"created_at"?: string,"data"?: NonNullable<Json>,"id"?: string,"story_id": string,"type": string
                  }
                  Update: {
                    "author_id"?: string,"chain_id"?: string | null,"correct_option"?: number | null,"created_at"?: string,"data"?: NonNullable<Json>,"id"?: string,"story_id"?: string,"type"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "story_stickers_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "story_stickers_story_id_fkey"
      columns: ["story_id"]
isOneToOne: false
      referencedRelation: "stories"
      referencedColumns: ["id"]
    }
                  ]
                },"story_views": {
                  Row: {
                    "story_id": string,"viewed_at": string,"viewer_id": string
                  }
                  Insert: {
                    "story_id": string,"viewed_at"?: string,"viewer_id"?: string
                  }
                  Update: {
                    "story_id"?: string,"viewed_at"?: string,"viewer_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "story_views_story_id_fkey"
      columns: ["story_id"]
isOneToOne: false
      referencedRelation: "stories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "story_views_viewer_id_fkey"
      columns: ["viewer_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"suggestion_dismissals": {
                  Row: {
                    "created_at": string,"target_id": string,"user_id": string
                  }
                  Insert: {
                    "created_at"?: string,"target_id": string,"user_id"?: string
                  }
                  Update: {
                    "created_at"?: string,"target_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "suggestion_dismissals_target_id_fkey"
      columns: ["target_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "suggestion_dismissals_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"thread_join_requests": {
                  Row: {
                    "added_by": string | null,"created_at": string,"thread_id": string,"user_id": string
                  }
                  Insert: {
                    "added_by"?: string | null,"created_at"?: string,"thread_id": string,"user_id": string
                  }
                  Update: {
                    "added_by"?: string | null,"created_at"?: string,"thread_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "thread_join_requests_added_by_fkey"
      columns: ["added_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "thread_join_requests_thread_id_fkey"
      columns: ["thread_id"]
isOneToOne: false
      referencedRelation: "threads"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "thread_join_requests_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"thread_members": {
                  Row: {
                    "accepted_at": string | null,"added_by": string | null,"cleared_at": string | null,"joined_at": string,"joined_via": string,"last_read_at": string,"left_at": string | null,"marked_unread": boolean,"muted_until": string | null,"nickname": string | null,"pinned_at": string | null,"read_receipts": boolean,"role": string,"status": string,"thread_id": string,"user_id": string
                  }
                  Insert: {
                    "accepted_at"?: string | null,"added_by"?: string | null,"cleared_at"?: string | null,"joined_at"?: string,"joined_via"?: string,"last_read_at"?: string,"left_at"?: string | null,"marked_unread"?: boolean,"muted_until"?: string | null,"nickname"?: string | null,"pinned_at"?: string | null,"read_receipts"?: boolean,"role"?: string,"status"?: string,"thread_id": string,"user_id": string
                  }
                  Update: {
                    "accepted_at"?: string | null,"added_by"?: string | null,"cleared_at"?: string | null,"joined_at"?: string,"joined_via"?: string,"last_read_at"?: string,"left_at"?: string | null,"marked_unread"?: boolean,"muted_until"?: string | null,"nickname"?: string | null,"pinned_at"?: string | null,"read_receipts"?: boolean,"role"?: string,"status"?: string,"thread_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "thread_members_added_by_fkey"
      columns: ["added_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "thread_members_thread_id_fkey"
      columns: ["thread_id"]
isOneToOne: false
      referencedRelation: "threads"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "thread_members_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"threads": {
                  Row: {
                    "approval_required": boolean,"created_at": string,"created_by": string | null,"direct_key": string | null,"id": string,"invite_token": string | null,"kind": string,"last_message_at": string | null,"last_message_id": string | null,"photo_path": string | null,"theme": string,"title": string | null,"vanish_mode": boolean
                  }
                  Insert: {
                    "approval_required"?: boolean,"created_at"?: string,"created_by"?: string | null,"direct_key"?: string | null,"id"?: string,"invite_token"?: string | null,"kind": string,"last_message_at"?: string | null,"last_message_id"?: string | null,"photo_path"?: string | null,"theme"?: string,"title"?: string | null,"vanish_mode"?: boolean
                  }
                  Update: {
                    "approval_required"?: boolean,"created_at"?: string,"created_by"?: string | null,"direct_key"?: string | null,"id"?: string,"invite_token"?: string | null,"kind"?: string,"last_message_at"?: string | null,"last_message_id"?: string | null,"photo_path"?: string | null,"theme"?: string,"title"?: string | null,"vanish_mode"?: boolean
                  }
                  Relationships: [
                    {
      foreignKeyName: "threads_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "threads_last_message_fk"
      columns: ["last_message_id"]
isOneToOne: false
      referencedRelation: "messages"
      referencedColumns: ["id"]
    }
                  ]
                },"user_presence": {
                  Row: {
                    "last_active_at": string,"user_id": string
                  }
                  Insert: {
                    "last_active_at"?: string,"user_id": string
                  }
                  Update: {
                    "last_active_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "user_presence_user_id_fkey"
      columns: ["user_id"]
isOneToOne: true
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
            "accept_thread":
{ Args: { "p_thread": string }; Returns: undefined
                           },
"account_about":
{ Args: { "p_user_id": string }; Returns: {
              "avatar_path": string,"date_joined": string,"former_usernames_count": number,"id": string,"username": string
            }[]
                           },
"activity_badge":
{ Args: Record<PropertyKey, never>; Returns: {
              "comments": number,"follows": number,"likes": number,"pending_requests": number,"requests": number,"unseen": number
            }[]
                           },
"activity_feed":
{ Args: { "p_before": string,"p_limit"?: number,"p_offset"?: number,"p_seen": string,"p_tz"?: string }; Returns: {
              "actor_count": number,"actor_follow": Json,"actors": Json,"audio": Json,"collab_status": string,"comment": Json,"data": Json,"group_key": string,"ids": (string)[],"latest_at": string,"post": Json,"section": string,"story": Json,"type": string
            }[]
                           },
"add_system_message":
{ Args: { "p_actor": string,"p_data"?: Json,"p_event": string,"p_thread": string }; Returns: string
                           },
"add_thread_members":
{ Args: { "p_members": (string)[],"p_thread": string }; Returns: string
                           },
"add_yours_chain":
{ Args: { "p_chain": string,"p_limit"?: number,"p_offset"?: number }; Returns: {
              "avatar_path": string,"is_active": boolean,"kind": string,"published_at": string,"story_id": string,"thumb_path": string,"user_id": string,"username": string
            }[]
                           },
"answer_join_request":
{ Args: { "p_approve": boolean,"p_thread": string,"p_user": string }; Returns: undefined
                           },
"approve_follow_request":
{ Args: { "requester": string }; Returns: boolean
                           },
"audio_page":
{ Args: { "p_track": string }; Returns: Json
                           },
"audio_reels":
{ Args: { "p_limit"?: number,"p_offset"?: number,"p_track": string }; Returns: {
              "author_id": string,"cover_offset": number,"cover_path": string,"id": string,"is_origin": boolean,"play_count": number
            }[]
                           },
"auth_lookup":
{ Args: { "identifier": string }; Returns: {
              "email": string,"has_profile": boolean,"user_id": string,"username": string
            }[]
                           },
"can_read_message":
{ Args: { "p_created": string,"p_scheduled": string,"p_sender": string,"p_thread": string }; Returns: boolean
                           },
"can_view_message_object":
{ Args: { "object_name": string }; Returns: boolean
                           },
"can_view_note":
{ Args: { "p_note": string }; Returns: boolean
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
"can_view_story":
{ Args: { "p_story": string }; Returns: boolean
                           },
"can_view_story_object":
{ Args: { "object_name": string }; Returns: boolean
                           },
"clear_requests":
{ Args: { "p_hidden"?: boolean }; Returns: number
                           },
"clear_thread":
{ Args: { "p_thread": string }; Returns: undefined
                           },
"comment_likers":
{ Args: { "p_comment": string,"p_limit"?: number,"p_offset"?: number,"p_search"?: string }; Returns: {
              "avatar_path": string,"follows_me": boolean,"full_name": string,"i_follow": boolean,"id": string,"is_private": boolean,"requested": boolean,"username": string
            }[]
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
"create_group_thread":
{ Args: { "p_members": (string)[],"p_title"?: string }; Returns: string
                           },
"create_thread_invite":
{ Args: { "p_thread": string }; Returns: string
                           },
"deliver_scheduled_messages":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"direct_badge":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"direct_key":
{ Args: { "a": string,"b": string }; Returns: string
                           },
"disable_thread_invite":
{ Args: { "p_thread": string }; Returns: undefined
                           },
"edit_message":
{ Args: { "p_body": string,"p_message": string }; Returns: undefined
                           },
"end_vanish_session":
{ Args: { "p_thread": string }; Returns: number
                           },
"ensure_direct_thread":
{ Args: { "p_me": string,"p_other": string }; Returns: string
                           },
"ensure_thread_admin":
{ Args: { "p_thread": string }; Returns: undefined
                           },
"explore_grid":
{ Args: { "p_limit"?: number,"p_offset"?: number,"p_snapshot"?: string }; Returns: {
              "author_id": string,"cover_offset": number,"cover_path": string,"cover_type": string,"id": string,"kind": string,"media_count": number,"play_count": number,"score": number
            }[]
                           },
"follow_request_summary":
{ Args: Record<PropertyKey, never>; Returns: {
              "latest": Json,"total": number
            }[]
                           },
"follow_user":
{ Args: { "target": string }; Returns: string
                           },
"following_feed":
{ Args: { "p_before"?: string,"p_before_id"?: string,"p_kind"?: string,"p_limit"?: number }; Returns: {
              "post_id": string,"published_at": string
            }[]
                           },
"get_or_create_direct":
{ Args: { "p_other": string }; Returns: string
                           },
"get_profile":
{ Args: { "p_user_id"?: string,"p_username"?: string }; Returns: {
              "avatar_path": string,"bio": string,"can_view": boolean,"created_at": string,"followers_count": number,"following_count": number,"follows_me": boolean,"full_name": string,"i_follow": boolean,"id": string,"is_close_friend": boolean,"is_favorite": boolean,"is_private": boolean,"is_self": boolean,"links": Json,"mutual_count": number,"mutual_preview": Json,"posts_count": number,"requested": boolean,"username": string
            }[]
                           },
"hashtag_page":
{ Args: { "p_name": string }; Returns: {
              "cover_path": string,"cover_post_id": string,"id": string,"name": string,"post_count": number
            }[]
                           },
"hashtag_posts":
{ Args: { "p_limit"?: number,"p_name": string,"p_offset"?: number,"p_tab"?: string }; Returns: {
              "author_id": string,"cover_offset": number,"cover_path": string,"cover_type": string,"id": string,"kind": string,"media_count": number,"play_count": number
            }[]
                           },
"highlight_reel":
{ Args: { "p_highlight": string }; Returns: Json[]
                           },
"home_feed":
{ Args: { "p_limit"?: number,"p_offset"?: number,"p_snapshot"?: string }; Returns: {
              "post_id": string,"reason": string,"repost_note": string,"reposted_by_id": string,"reposted_by_username": string,"score": number
            }[]
                           },
"inbox_threads":
{ Args: { "p_before"?: string,"p_folder"?: string,"p_limit"?: number,"p_query"?: string }; Returns: {
              "id": string,"kind": string,"last_message": Json,"last_message_at": string,"member_count": number,"members": Json,"muted": boolean,"my_role": string,"my_status": string,"photo_path": string,"pinned_at": string,"seen": boolean,"theme": string,"title": string,"unread": boolean,"unread_count": number,"vanish_mode": boolean
            }[]
                           },
"is_flagged_text":
{ Args: { "p_body": string }; Returns: boolean
                           },
"is_valid_caption":
{ Args: { "caption": string }; Returns: boolean
                           },
"is_valid_comment":
{ Args: { "body": string }; Returns: boolean
                           },
"is_valid_profile_links":
{ Args: { "links": Json }; Returns: boolean
                           },
"is_valid_story_sticker":
{ Args: { "p_correct": number,"p_data": Json,"p_type": string }; Returns: boolean
                           },
"is_valid_username":
{ Args: { "name": string }; Returns: boolean
                           },
"join_thread_by_invite":
{ Args: { "p_token": string }; Returns: Json
                           },
"leave_thread":
{ Args: { "p_thread": string }; Returns: undefined
                           },
"mark_activity_seen":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"mark_posts_seen":
{ Args: { "p_ids": (string)[] }; Returns: undefined
                           },
"mark_stories_viewed":
{ Args: { "p_ids": (string)[] }; Returns: undefined
                           },
"mark_thread_read":
{ Args: { "p_thread": string }; Returns: undefined
                           },
"message_delivered":
{ Args: { "p_message": string }; Returns: undefined
                           },
"my_collab_invites":
{ Args: Record<PropertyKey, never>; Returns: {
              "author_avatar_path": string,"author_id": string,"author_username": string,"cover_path": string,"invited_at": string,"post_id": string
            }[]
                           },
"my_follow_requests":
{ Args: { "p_limit"?: number,"p_offset"?: number,"p_search"?: string }; Returns: {
              "avatar_path": string,"created_at": string,"full_name": string,"i_follow": boolean,"id": string,"is_private": boolean,"requested": boolean,"username": string
            }[]
                           },
"my_purgeable_message_files":
{ Args: Record<PropertyKey, never>; Returns: string[]
                           },
"my_purgeable_stories":
{ Args: Record<PropertyKey, never>; Returns: {
              "files": (string)[],"id": string
            }[]
                           },
"my_reels":
{ Args: { "p_limit"?: number }; Returns: {
              "caption": string,"cover_offset": number,"cover_path": string,"id": string,"published_at": string
            }[]
                           },
"my_thread_status":
{ Args: { "p_thread": string }; Returns: string
                           },
"normalize_hashtag":
{ Args: { "p_name": string }; Returns: string
                           },
"note_likers":
{ Args: { "p_note": string }; Returns: {
              "avatar_path": string,"full_name": string,"liked_at": string,"user_id": string,"username": string
            }[]
                           },
"note_screenshot":
{ Args: { "p_message"?: string,"p_thread": string }; Returns: undefined
                           },
"notes_tray":
{ Args: Record<PropertyKey, never>; Returns: {
              "audience": string,"audio": Json,"author_id": string,"avatar_path": string,"body": string,"created_at": string,"expires_at": string,"full_name": string,"id": string,"like_count": number,"liked": boolean,"username": string
            }[]
                           },
"notification_preview":
{ Args: { "p_id": string }; Returns: {
              "actor_avatar_path": string,"actor_username": string,"comment_body": string,"data": Json,"id": string,"post_id": string,"post_kind": string,"story_id": string,"type": string
            }[]
                           },
"notify":
{ Args: { "p_actor": string,"p_at"?: string,"p_audio"?: string,"p_comment"?: string,"p_data"?: Json,"p_post"?: string,"p_recipient": string,"p_story"?: string,"p_type": string }; Returns: undefined
                           },
"open_message_media":
{ Args: { "p_message": string }; Returns: boolean
                           },
"people_picker":
{ Args: { "p_limit"?: number,"p_search"?: string }; Returns: {
              "avatar_path": string,"full_name": string,"i_follow": boolean,"id": string,"is_close_friend": boolean,"is_favorite": boolean,"username": string
            }[]
                           },
"pin_message":
{ Args: { "p_message": string,"p_pinned": boolean }; Returns: undefined
                           },
"post_base_score":
{ Args: { "p_comments": number,"p_likes": number,"p_now": string,"p_plays": number,"p_published_at": string,"p_reposts": number }; Returns: number
                           },
"post_cards":
{ Args: { "p_ids": (string)[] }; Returns: Json[]
                           },
"post_comments":
{ Args: { "p_kind"?: string,"p_limit"?: number,"p_offset"?: number,"p_parent"?: string,"p_post": string }; Returns: {
              "author_id": string,"avatar_path": string,"body": string,"created_at": string,"id": string,"is_hidden": boolean,"is_pinned": boolean,"is_post_author": boolean,"like_count": number,"liked": boolean,"liked_by_post_author": boolean,"parent_id": string,"post_id": string,"reply_count": number,"username": string
            }[]
                           },
"post_likers":
{ Args: { "p_limit"?: number,"p_offset"?: number,"p_post": string,"p_search"?: string }; Returns: {
              "avatar_path": string,"follows_me": boolean,"full_name": string,"i_follow": boolean,"id": string,"is_private": boolean,"requested": boolean,"username": string
            }[]
                           },
"post_owners":
{ Args: { "p_post": string }; Returns: string[]
                           },
"post_tile":
{ Args: { "p_id": string }; Returns: {
              "author_id": string,"cover_offset": number,"cover_path": string,"cover_type": string,"id": string,"kind": string,"media_count": number,"play_count": number
            }[]
                           },
"presence_of":
{ Args: { "p_users": (string)[] }; Returns: {
              "last_active_at": string,"user_id": string
            }[]
                           },
"profile_connections":
{ Args: { "p_kind": string,"p_limit"?: number,"p_offset"?: number,"p_search"?: string,"p_user_id": string }; Returns: {
              "avatar_path": string,"followed_at": string,"follows_me": boolean,"full_name": string,"i_follow": boolean,"id": string,"is_private": boolean,"is_self": boolean,"requested": boolean,"username": string
            }[]
                           },
"profile_highlights":
{ Args: { "p_user": string }; Returns: {
              "cover_path": string,"first_story_id": string,"first_story_kind": string,"first_thumb_path": string,"id": string,"item_count": number,"position": number,"title": string
            }[]
                           },
"profile_posts":
{ Args: { "p_kind"?: string,"p_limit"?: number,"p_offset"?: number,"p_user": string }; Returns: {
              "archived_at": string,"audience": string,"author_id": string,"cover_offset": number,"cover_path": string,"cover_type": string,"id": string,"is_pinned": boolean,"kind": string,"media_count": number,"play_count": number,"published_at": string
            }[]
                           },
"publish_post":
{ Args: { "p_post": string }; Returns: string
                           },
"publish_story":
{ Args: { "p_story": string }; Returns: string
                           },
"realtime_thread_member":
{ Args: { "p_active": boolean,"p_topic": string }; Returns: boolean
                           },
"recent_searches":
{ Args: { "p_limit"?: number }; Returns: {
              "audio_artist": string,"audio_cover_color": string,"audio_owner_avatar_path": string,"audio_source": string,"audio_title": string,"avatar_path": string,"full_name": string,"i_follow": boolean,"id": string,"is_private": boolean,"kind": string,"post_count": number,"query": string,"searched_at": string,"tag_name": string,"target_id": string,"username": string
            }[]
                           },
"record_reel_play":
{ Args: { "p_post": string }; Returns: undefined
                           },
"record_search":
{ Args: { "p_kind": string,"p_query"?: string,"p_target"?: string }; Returns: undefined
                           },
"reel_remixes":
{ Args: { "p_limit"?: number,"p_offset"?: number,"p_post": string }; Returns: {
              "author_id": string,"cover_offset": number,"cover_path": string,"id": string,"play_count": number
            }[]
                           },
"reels_feed":
{ Args: { "p_limit"?: number,"p_offset"?: number,"p_snapshot"?: string }; Returns: {
              "post_id": string,"reason": string,"score": number
            }[]
                           },
"refresh_posts_count":
{ Args: { "p_user": string }; Returns: undefined
                           },
"remove_thread_member":
{ Args: { "p_thread": string,"p_user": string }; Returns: undefined
                           },
"rename_original_audio":
{ Args: { "p_title": string,"p_track": string }; Returns: string
                           },
"rename_thread":
{ Args: { "p_thread": string,"p_title": string }; Returns: undefined
                           },
"reorder_post_media":
{ Args: { "p_media": (string)[],"p_post": string }; Returns: undefined
                           },
"require_thread_member":
{ Args: { "p_admin"?: boolean,"p_thread": string }; Returns: {
              "accepted_at": string | null,
"added_by": string | null,
"cleared_at": string | null,
"joined_at": string,
"joined_via": string,
"last_read_at": string,
"left_at": string | null,
"marked_unread": boolean,
"muted_until": string | null,
"nickname": string | null,
"pinned_at": string | null,
"read_receipts": boolean,
"role": string,
"status": string,
"thread_id": string,
"user_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "thread_members"
        isOneToOne: true
        isSetofReturn: false
      } },
"respond_collab_invite":
{ Args: { "p_accept": boolean,"p_post": string }; Returns: boolean
                           },
"save_highlight":
{ Args: { "p_cover_path": string,"p_highlight": string,"p_story_ids": (string)[],"p_title": string }; Returns: string
                           },
"saved_posts":
{ Args: { "p_collection"?: string,"p_limit"?: number,"p_offset"?: number }; Returns: {
              "author_id": string,"cover_path": string,"cover_type": string,"id": string,"media_count": number,"saved_at": string
            }[]
                           },
"search_accounts":
{ Args: { "p_limit"?: number,"p_offset"?: number,"p_query": string }; Returns: {
              "avatar_path": string,"followed_by": string,"full_name": string,"i_follow": boolean,"id": string,"is_private": boolean,"mutual_count": number,"requested": boolean,"username": string
            }[]
                           },
"search_audio":
{ Args: { "p_limit"?: number,"p_offset"?: number,"p_query": string }; Returns: {
              "artist": string,"audio_path": string,"cover_color": string,"duration_ms": number,"id": string,"owner_avatar_path": string,"owner_username": string,"reel_count": number,"source": string,"title": string
            }[]
                           },
"search_hashtags":
{ Args: { "p_limit"?: number,"p_offset"?: number,"p_query": string }; Returns: {
              "id": string,"name": string,"post_count": number
            }[]
                           },
"search_posts":
{ Args: { "p_kind"?: string,"p_limit"?: number,"p_offset"?: number,"p_query": string }; Returns: {
              "author_id": string,"cover_offset": number,"cover_path": string,"cover_type": string,"id": string,"kind": string,"media_count": number,"play_count": number
            }[]
                           },
"search_profiles":
{ Args: { "p_limit"?: number,"p_query": string }; Returns: {
              "avatar_path": string,"full_name": string,"i_follow": boolean,"id": string,"is_private": boolean,"username": string
            }[]
                           },
"set_comment_hidden":
{ Args: { "p_comment": string,"p_hidden": boolean }; Returns: undefined
                           },
"set_comment_pinned":
{ Args: { "p_comment": string,"p_pinned": boolean }; Returns: undefined
                           },
"set_nickname":
{ Args: { "p_nickname": string,"p_thread": string,"p_user": string }; Returns: undefined
                           },
"set_thread_admin":
{ Args: { "p_admin": boolean,"p_thread": string,"p_user": string }; Returns: undefined
                           },
"set_thread_approval":
{ Args: { "p_on": boolean,"p_thread": string }; Returns: undefined
                           },
"set_thread_photo":
{ Args: { "p_path": string,"p_thread": string }; Returns: undefined
                           },
"set_thread_theme":
{ Args: { "p_theme": string,"p_thread": string }; Returns: undefined
                           },
"set_vanish_mode":
{ Args: { "p_on": boolean,"p_thread": string }; Returns: undefined
                           },
"share_suggestions":
{ Args: { "p_limit"?: number,"p_query"?: string }; Returns: {
              "avatar_path": string,"full_name": string,"kind": string,"last_message_at": string,"members": Json,"photo_path": string,"thread_id": string,"title": string,"user_id": string,"username": string
            }[]
                           },
"similar_posts":
{ Args: { "p_limit"?: number,"p_offset"?: number,"p_post": string,"p_snapshot"?: string }; Returns: {
              "post_id": string,"score": number,"similarity": number
            }[]
                           },
"stories_tray":
{ Args: Record<PropertyKey, never>; Returns: {
              "avatar_path": string,"has_close_friends": boolean,"has_unseen": boolean,"is_own": boolean,"latest_at": string,"story_count": number,"user_id": string,"username": string
            }[]
                           },
"story_archive":
{ Args: { "p_limit"?: number,"p_offset"?: number }; Returns: {
              "audience": string,"content": Json,"height": number,"id": string,"in_highlight": boolean,"is_active": boolean,"kind": string,"media_path": string,"published_at": string,"thumb_path": string,"width": number
            }[]
                           },
"story_cards":
{ Args: { "p_ids": (string)[] }; Returns: Json[]
                           },
"story_files_scoped":
{ Args: { "p_author": string,"p_files": (string)[],"p_story": string }; Returns: boolean
                           },
"story_is_active":
{ Args: { "p_story": string }; Returns: boolean
                           },
"story_reel":
{ Args: { "p_user": string }; Returns: Json[]
                           },
"story_replies_allowed":
{ Args: { "p_author": string,"p_sender": string }; Returns: boolean
                           },
"story_responses":
{ Args: { "p_story": string }; Returns: {
              "avatar_path": string,"body": string,"created_at": string,"id": string,"option": number,"sticker_id": string,"type": string,"user_id": string,"username": string,"value": number
            }[]
                           },
"story_rings":
{ Args: { "p_users": (string)[] }; Returns: {
              "has_close_friends": boolean,"has_unseen": boolean,"latest_at": string,"story_count": number,"user_id": string
            }[]
                           },
"story_sticker_results":
{ Args: { "p_sticker": string }; Returns: Json
                           },
"story_viewers":
{ Args: { "p_limit"?: number,"p_offset"?: number,"p_search"?: string,"p_story": string }; Returns: {
              "avatar_path": string,"follows_me": boolean,"full_name": string,"i_follow": boolean,"is_hidden": boolean,"liked": boolean,"reply": string,"reply_is_reaction": boolean,"responses": Json,"user_id": string,"username": string,"viewed_at": string
            }[]
                           },
"suggest_usernames":
{ Args: { "full_name": string,"max_count"?: number }; Returns: (string)[]
                           },
"suggested_accounts":
{ Args: { "max_count"?: number,"p_offset"?: number }; Returns: {
              "avatar_path": string,"follows_me": boolean,"full_name": string,"id": string,"is_private": boolean,"mutual_count": number,"mutual_username": string,"reason": string,"username": string
            }[]
                           },
"suggested_posts":
{ Args: { "p_limit"?: number,"p_offset"?: number,"p_snapshot"?: string }; Returns: {
              "post_id": string,"score": number
            }[]
                           },
"sync_countdown_notifications":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"sync_post_caption_refs":
{ Args: { "p_caption": string,"p_post": string }; Returns: undefined
                           },
"thread_add_members":
{ Args: { "p_actor": string,"p_ids": (string)[],"p_thread": string,"p_via"?: string }; Returns: number
                           },
"thread_broadcast":
{ Args: { "p_event": string,"p_payload"?: Json,"p_thread": string }; Returns: undefined
                           },
"thread_info":
{ Args: { "p_thread": string }; Returns: Json
                           },
"thread_invite_preview":
{ Args: { "p_token": string }; Returns: Json
                           },
"thread_join_request_list":
{ Args: { "p_thread": string }; Returns: {
              "added_by_username": string,"avatar_path": string,"created_at": string,"full_name": string,"user_id": string,"username": string
            }[]
                           },
"thread_messages":
{ Args: { "p_before"?: string,"p_filter"?: string,"p_limit"?: number,"p_query"?: string,"p_thread": string }; Returns: {
              "audio": Json,"body": string,"created_at": string,"data": Json,"duration_ms": number,"edited_at": string,"height": number,"id": string,"kind": string,"media_path": string,"media_type": string,"pinned_at": string,"post_id": string,"profile": Json,"reactions": Json,"reply_to": Json,"scheduled_for": string,"sender_id": string,"story": Json,"thread_id": string,"thumb_path": string,"vanish": boolean,"view_mode": string,"views": Json,"waveform": Json,"width": number
            }[]
                           },
"touch_presence":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"unfollow_user":
{ Args: { "target": string }; Returns: undefined
                           },
"username_available":
{ Args: { "name": string }; Returns: boolean
                           },
"visible_notifications":
{ Args: { "p_before"?: string }; Returns: {
              "actor_id": string,
"audio_id": string | null,
"comment_id": string | null,
"created_at": string,
"data": NonNullable<Json>,
"id": string,
"post_id": string | null,
"recipient_id": string,
"story_id": string | null,
"type": string
            }[]
                          SetofOptions: {
        from: "*"
        to: "notifications"
        isOneToOne: false
        isSetofReturn: true
      } }
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
