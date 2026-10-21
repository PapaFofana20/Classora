
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "absences": {
                  Row: {
                    "absence_date": string,"absence_type": string,"created_at": string,"id": string,"justified": boolean,"motif": string,"sanction": string | null,"school_id": string,"student_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "absence_date": string,"absence_type": string,"created_at"?: string,"id"?: string,"justified"?: boolean,"motif"?: string,"sanction"?: string | null,"school_id": string,"student_id": string
                  }
                  Update: {
                    "absence_date"?: string,"absence_type"?: string,"created_at"?: string,"id"?: string,"justified"?: boolean,"motif"?: string,"sanction"?: string | null,"school_id"?: string,"student_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "absences_school_id_fkey"
      columns: ["school_id"]
isOneToOne: false
      referencedRelation: "schools"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "absences_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "students"
      referencedColumns: ["id"]
    }
                  ]
                },"announcements": {
                  Row: {
                    "audience_all": boolean,"audience_roles": (string)[],"author": string,"body": string,"created_at": string,"id": string,"school_id": string,"title": string
                  }
                  ComputedFields: never
                  Insert: {
                    "audience_all"?: boolean,"audience_roles"?: (string)[],"author"?: string,"body": string,"created_at"?: string,"id"?: string,"school_id": string,"title": string
                  }
                  Update: {
                    "audience_all"?: boolean,"audience_roles"?: (string)[],"author"?: string,"body"?: string,"created_at"?: string,"id"?: string,"school_id"?: string,"title"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "announcements_school_id_fkey"
      columns: ["school_id"]
isOneToOne: false
      referencedRelation: "schools"
      referencedColumns: ["id"]
    }
                  ]
                },"audit_log": {
                  Row: {
                    "action": string,"actor_id": string | null,"actor_role": string | null,"created_at": string,"entity": string,"entity_id": string | null,"id": string,"payload": NonNullable<Json>,"school_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id"?: string | null,"actor_role"?: string | null,"created_at"?: string,"entity": string,"entity_id"?: string | null,"id"?: string,"payload"?: NonNullable<Json>,"school_id"?: string | null
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"actor_role"?: string | null,"created_at"?: string,"entity"?: string,"entity_id"?: string | null,"id"?: string,"payload"?: NonNullable<Json>,"school_id"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"class_rooms": {
                  Row: {
                    "capacity": number,"created_at": string,"cycle": string,"head_teacher_id": string | null,"id": string,"level_id": string,"name": string,"school_id": string,"series": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "capacity"?: number,"created_at"?: string,"cycle": string,"head_teacher_id"?: string | null,"id"?: string,"level_id": string,"name": string,"school_id": string,"series"?: string | null
                  }
                  Update: {
                    "capacity"?: number,"created_at"?: string,"cycle"?: string,"head_teacher_id"?: string | null,"id"?: string,"level_id"?: string,"name"?: string,"school_id"?: string,"series"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "class_rooms_head_teacher_id_fkey"
      columns: ["head_teacher_id"]
isOneToOne: false
      referencedRelation: "teachers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "class_rooms_level_id_fkey"
      columns: ["level_id"]
isOneToOne: false
      referencedRelation: "levels"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "class_rooms_school_id_fkey"
      columns: ["school_id"]
isOneToOne: false
      referencedRelation: "schools"
      referencedColumns: ["id"]
    }
                  ]
                },"class_subjects": {
                  Row: {
                    "class_id": string,"coefficient": number,"created_at": string,"id": string,"school_id": string,"subject_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "class_id": string,"coefficient"?: number,"created_at"?: string,"id"?: string,"school_id": string,"subject_id": string
                  }
                  Update: {
                    "class_id"?: string,"coefficient"?: number,"created_at"?: string,"id"?: string,"school_id"?: string,"subject_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "class_subjects_class_id_fkey"
      columns: ["class_id"]
isOneToOne: false
      referencedRelation: "class_rooms"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "class_subjects_school_id_fkey"
      columns: ["school_id"]
isOneToOne: false
      referencedRelation: "schools"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "class_subjects_subject_id_fkey"
      columns: ["subject_id"]
isOneToOne: false
      referencedRelation: "subjects"
      referencedColumns: ["id"]
    }
                  ]
                },"contact_messages": {
                  Row: {
                    "created_at": string,"email": string,"id": string,"message": string,"name": string,"phone": string,"school": string | null,"subject": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"email": string,"id"?: string,"message": string,"name": string,"phone"?: string,"school"?: string | null,"subject": string
                  }
                  Update: {
                    "created_at"?: string,"email"?: string,"id"?: string,"message"?: string,"name"?: string,"phone"?: string,"school"?: string | null,"subject"?: string
                  }
                  Relationships: [
                    
                  ]
                },"conversation_reads": {
                  Row: {
                    "actor_id": string,"conversation_id": string,"last_read_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "actor_id": string,"conversation_id": string,"last_read_at"?: string
                  }
                  Update: {
                    "actor_id"?: string,"conversation_id"?: string,"last_read_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "conversation_reads_conversation_id_fkey"
      columns: ["conversation_id"]
isOneToOne: false
      referencedRelation: "conversations"
      referencedColumns: ["id"]
    }
                  ]
                },"conversations": {
                  Row: {
                    "created_at": string,"id": string,"parent_id": string,"school_id": string,"student_id": string,"subject": string,"teacher_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"parent_id": string,"school_id": string,"student_id": string,"subject"?: string,"teacher_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"parent_id"?: string,"school_id"?: string,"student_id"?: string,"subject"?: string,"teacher_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "conversations_parent_id_fkey"
      columns: ["parent_id"]
isOneToOne: false
      referencedRelation: "parents"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "conversations_school_id_fkey"
      columns: ["school_id"]
isOneToOne: false
      referencedRelation: "schools"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "conversations_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "students"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "conversations_teacher_id_fkey"
      columns: ["teacher_id"]
isOneToOne: false
      referencedRelation: "teachers"
      referencedColumns: ["id"]
    }
                  ]
                },"counters": {
                  Row: {
                    "counter": string,"school_id": string,"updated_at": string,"value": number,"year": string
                  }
                  ComputedFields: never
                  Insert: {
                    "counter": string,"school_id": string,"updated_at"?: string,"value"?: number,"year": string
                  }
                  Update: {
                    "counter"?: string,"school_id"?: string,"updated_at"?: string,"value"?: number,"year"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "counters_school_id_fkey"
      columns: ["school_id"]
isOneToOne: false
      referencedRelation: "schools"
      referencedColumns: ["id"]
    }
                  ]
                },"grades": {
                  Row: {
                    "class_id": string,"composition": number | null,"created_at": string,"devoir1": number | null,"devoir2": number | null,"id": string,"period": string,"school_id": string,"student_id": string,"subject_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "class_id": string,"composition"?: number | null,"created_at"?: string,"devoir1"?: number | null,"devoir2"?: number | null,"id"?: string,"period": string,"school_id": string,"student_id": string,"subject_id": string,"updated_at"?: string
                  }
                  Update: {
                    "class_id"?: string,"composition"?: number | null,"created_at"?: string,"devoir1"?: number | null,"devoir2"?: number | null,"id"?: string,"period"?: string,"school_id"?: string,"student_id"?: string,"subject_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "grades_class_id_fkey"
      columns: ["class_id"]
isOneToOne: false
      referencedRelation: "class_rooms"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "grades_school_id_fkey"
      columns: ["school_id"]
isOneToOne: false
      referencedRelation: "schools"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "grades_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "students"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "grades_subject_id_fkey"
      columns: ["subject_id"]
isOneToOne: false
      referencedRelation: "subjects"
      referencedColumns: ["id"]
    }
                  ]
                },"level_fees": {
                  Row: {
                    "created_at": string,"inscription": number,"level_id": string,"mensualite": number,"school_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"inscription": number,"level_id": string,"mensualite": number,"school_id": string
                  }
                  Update: {
                    "created_at"?: string,"inscription"?: number,"level_id"?: string,"mensualite"?: number,"school_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "level_fees_level_id_fkey"
      columns: ["level_id"]
isOneToOne: false
      referencedRelation: "levels"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "level_fees_school_id_fkey"
      columns: ["school_id"]
isOneToOne: false
      referencedRelation: "schools"
      referencedColumns: ["id"]
    }
                  ]
                },"levels": {
                  Row: {
                    "cycle": string,"exam": string | null,"id": string,"label": string,"level_order": number
                  }
                  ComputedFields: never
                  Insert: {
                    "cycle": string,"exam"?: string | null,"id": string,"label": string,"level_order": number
                  }
                  Update: {
                    "cycle"?: string,"exam"?: string | null,"id"?: string,"label"?: string,"level_order"?: number
                  }
                  Relationships: [
                    
                  ]
                },"messages": {
                  Row: {
                    "conversation_id": string,"created_at": string,"id": string,"school_id": string,"sender_id": string,"text": string
                  }
                  ComputedFields: never
                  Insert: {
                    "conversation_id": string,"created_at"?: string,"id"?: string,"school_id": string,"sender_id": string,"text": string
                  }
                  Update: {
                    "conversation_id"?: string,"created_at"?: string,"id"?: string,"school_id"?: string,"sender_id"?: string,"text"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "messages_conversation_id_fkey"
      columns: ["conversation_id"]
isOneToOne: false
      referencedRelation: "conversations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "messages_school_id_fkey"
      columns: ["school_id"]
isOneToOne: false
      referencedRelation: "schools"
      referencedColumns: ["id"]
    }
                  ]
                },"parents": {
                  Row: {
                    "address": string,"created_at": string,"email": string,"first_name": string,"id": string,"last_name": string,"phone": string,"school_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "address"?: string,"created_at"?: string,"email"?: string,"first_name": string,"id"?: string,"last_name": string,"phone"?: string,"school_id": string
                  }
                  Update: {
                    "address"?: string,"created_at"?: string,"email"?: string,"first_name"?: string,"id"?: string,"last_name"?: string,"phone"?: string,"school_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "parents_school_id_fkey"
      columns: ["school_id"]
isOneToOne: false
      referencedRelation: "schools"
      referencedColumns: ["id"]
    }
                  ]
                },"payment_transactions": {
                  Row: {
                    "amount": number,"created_at": string,"id": string,"method": string,"payload": NonNullable<Json>,"payment_id": string | null,"phone": string,"provider": string,"provider_ref": string,"school_id": string,"status": string,"tx_kind": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"created_at"?: string,"id"?: string,"method": string,"payload"?: NonNullable<Json>,"payment_id"?: string | null,"phone": string,"provider": string,"provider_ref": string,"school_id": string,"status"?: string,"tx_kind": string,"updated_at"?: string
                  }
                  Update: {
                    "amount"?: number,"created_at"?: string,"id"?: string,"method"?: string,"payload"?: NonNullable<Json>,"payment_id"?: string | null,"phone"?: string,"provider"?: string,"provider_ref"?: string,"school_id"?: string,"status"?: string,"tx_kind"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "payment_transactions_payment_id_fkey"
      columns: ["payment_id"]
isOneToOne: false
      referencedRelation: "payments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payment_transactions_school_id_fkey"
      columns: ["school_id"]
isOneToOne: false
      referencedRelation: "schools"
      referencedColumns: ["id"]
    }
                  ]
                },"payments": {
                  Row: {
                    "amount": number,"created_at": string,"due_date": string,"id": string,"kind": string,"label": string,"method": string | null,"paid_amount": number,"paid_at": string | null,"reference": string | null,"school_id": string,"status": string,"student_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"created_at"?: string,"due_date": string,"id"?: string,"kind": string,"label": string,"method"?: string | null,"paid_amount"?: number,"paid_at"?: string | null,"reference"?: string | null,"school_id": string,"status"?: string,"student_id": string
                  }
                  Update: {
                    "amount"?: number,"created_at"?: string,"due_date"?: string,"id"?: string,"kind"?: string,"label"?: string,"method"?: string | null,"paid_amount"?: number,"paid_at"?: string | null,"reference"?: string | null,"school_id"?: string,"status"?: string,"student_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "payments_school_id_fkey"
      columns: ["school_id"]
isOneToOne: false
      referencedRelation: "schools"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payments_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "students"
      referencedColumns: ["id"]
    }
                  ]
                },"plans": {
                  Row: {
                    "created_at": string,"features": (string)[],"highlight": boolean,"id": string,"monthly_price": number,"name": string,"student_limit": number | null,"tagline": string,"yearly_price": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"features"?: (string)[],"highlight"?: boolean,"id": string,"monthly_price": number,"name": string,"student_limit"?: number | null,"tagline"?: string,"yearly_price": number
                  }
                  Update: {
                    "created_at"?: string,"features"?: (string)[],"highlight"?: boolean,"id"?: string,"monthly_price"?: number,"name"?: string,"student_limit"?: number | null,"tagline"?: string,"yearly_price"?: number
                  }
                  Relationships: [
                    
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"email": string,"first_name": string,"id": string,"last_name": string,"must_change_password": boolean,"parent_id": string | null,"phone": string,"role": string,"school_id": string,"status": string,"student_id": string | null,"teacher_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"email": string,"first_name": string,"id": string,"last_name": string,"must_change_password"?: boolean,"parent_id"?: string | null,"phone"?: string,"role": string,"school_id": string,"status"?: string,"student_id"?: string | null,"teacher_id"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"email"?: string,"first_name"?: string,"id"?: string,"last_name"?: string,"must_change_password"?: boolean,"parent_id"?: string | null,"phone"?: string,"role"?: string,"school_id"?: string,"status"?: string,"student_id"?: string | null,"teacher_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "profiles_parent_id_fkey"
      columns: ["parent_id"]
isOneToOne: false
      referencedRelation: "parents"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "profiles_school_id_fkey"
      columns: ["school_id"]
isOneToOne: false
      referencedRelation: "schools"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "profiles_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "students"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "profiles_teacher_id_fkey"
      columns: ["teacher_id"]
isOneToOne: false
      referencedRelation: "teachers"
      referencedColumns: ["id"]
    }
                  ]
                },"rate_limits": {
                  Row: {
                    "count": number,"key": string,"updated_at": string,"window_start": string
                  }
                  ComputedFields: never
                  Insert: {
                    "count"?: number,"key": string,"updated_at"?: string,"window_start"?: string
                  }
                  Update: {
                    "count"?: number,"key"?: string,"updated_at"?: string,"window_start"?: string
                  }
                  Relationships: [
                    
                  ]
                },"registration_requests": {
                  Row: {
                    "birth_date": string | null,"child_code": string | null,"class_id": string | null,"created_at": string,"decided_at": string | null,"email": string,"first_name": string,"gender": string | null,"id": string,"last_name": string,"phone": string,"reason": string | null,"role": string,"school_id": string,"status": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "birth_date"?: string | null,"child_code"?: string | null,"class_id"?: string | null,"created_at"?: string,"decided_at"?: string | null,"email": string,"first_name": string,"gender"?: string | null,"id"?: string,"last_name": string,"phone"?: string,"reason"?: string | null,"role": string,"school_id": string,"status"?: string,"user_id": string
                  }
                  Update: {
                    "birth_date"?: string | null,"child_code"?: string | null,"class_id"?: string | null,"created_at"?: string,"decided_at"?: string | null,"email"?: string,"first_name"?: string,"gender"?: string | null,"id"?: string,"last_name"?: string,"phone"?: string,"reason"?: string | null,"role"?: string,"school_id"?: string,"status"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "registration_requests_class_id_fkey"
      columns: ["class_id"]
isOneToOne: false
      referencedRelation: "class_rooms"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "registration_requests_school_id_fkey"
      columns: ["school_id"]
isOneToOne: false
      referencedRelation: "schools"
      referencedColumns: ["id"]
    }
                  ]
                },"report_metas": {
                  Row: {
                    "absences": number,"comment": string,"conduct": string,"created_at": string,"id": string,"period": string,"school_id": string,"student_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "absences"?: number,"comment"?: string,"conduct"?: string,"created_at"?: string,"id"?: string,"period": string,"school_id": string,"student_id": string,"updated_at"?: string
                  }
                  Update: {
                    "absences"?: number,"comment"?: string,"conduct"?: string,"created_at"?: string,"id"?: string,"period"?: string,"school_id"?: string,"student_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "report_metas_school_id_fkey"
      columns: ["school_id"]
isOneToOne: false
      referencedRelation: "schools"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "report_metas_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "students"
      referencedColumns: ["id"]
    }
                  ]
                },"school_settings": {
                  Row: {
                    "annex_fees": NonNullable<Json>,"created_at": string,"current_period": string,"period_type": string,"school_id": string,"school_year": string,"sibling_discount": number
                  }
                  ComputedFields: never
                  Insert: {
                    "annex_fees"?: NonNullable<Json>,"created_at"?: string,"current_period"?: string,"period_type"?: string,"school_id": string,"school_year"?: string,"sibling_discount"?: number
                  }
                  Update: {
                    "annex_fees"?: NonNullable<Json>,"created_at"?: string,"current_period"?: string,"period_type"?: string,"school_id"?: string,"school_year"?: string,"sibling_discount"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "school_settings_school_id_fkey"
      columns: ["school_id"]
isOneToOne: true
      referencedRelation: "schools"
      referencedColumns: ["id"]
    }
                  ]
                },"schools": {
                  Row: {
                    "address": string,"auto_approve_students": boolean,"city": string,"created_at": string,"cycles": (unknown)[],"email": string,"id": string,"logo_url": string | null,"matricule": string | null,"name": string,"phone": string,"registration_open": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "address"?: string,"auto_approve_students"?: boolean,"city"?: string,"created_at"?: string,"cycles"?: (unknown)[],"email"?: string,"id"?: string,"logo_url"?: string | null,"matricule"?: string | null,"name": string,"phone"?: string,"registration_open"?: boolean
                  }
                  Update: {
                    "address"?: string,"auto_approve_students"?: boolean,"city"?: string,"created_at"?: string,"cycles"?: (unknown)[],"email"?: string,"id"?: string,"logo_url"?: string | null,"matricule"?: string | null,"name"?: string,"phone"?: string,"registration_open"?: boolean
                  }
                  Relationships: [
                    
                  ]
                },"students": {
                  Row: {
                    "birth_date": string | null,"child_code": string,"class_id": string,"created_at": string,"enrolled_at": string,"first_name": string,"gender": string,"id": string,"last_name": string,"matricule": string,"options": NonNullable<Json>,"parent_id": string | null,"school_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "birth_date"?: string | null,"child_code": string,"class_id": string,"created_at"?: string,"enrolled_at"?: string,"first_name": string,"gender": string,"id"?: string,"last_name": string,"matricule": string,"options"?: NonNullable<Json>,"parent_id"?: string | null,"school_id": string
                  }
                  Update: {
                    "birth_date"?: string | null,"child_code"?: string,"class_id"?: string,"created_at"?: string,"enrolled_at"?: string,"first_name"?: string,"gender"?: string,"id"?: string,"last_name"?: string,"matricule"?: string,"options"?: NonNullable<Json>,"parent_id"?: string | null,"school_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "students_class_id_fkey"
      columns: ["class_id"]
isOneToOne: false
      referencedRelation: "class_rooms"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "students_parent_id_fkey"
      columns: ["parent_id"]
isOneToOne: false
      referencedRelation: "parents"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "students_school_id_fkey"
      columns: ["school_id"]
isOneToOne: false
      referencedRelation: "schools"
      referencedColumns: ["id"]
    }
                  ]
                },"subjects": {
                  Row: {
                    "created_at": string,"cycles": (unknown)[],"id": string,"name": string,"school_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"cycles"?: (unknown)[],"id"?: string,"name": string,"school_id": string
                  }
                  Update: {
                    "created_at"?: string,"cycles"?: (unknown)[],"id"?: string,"name"?: string,"school_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "subjects_school_id_fkey"
      columns: ["school_id"]
isOneToOne: false
      referencedRelation: "schools"
      referencedColumns: ["id"]
    }
                  ]
                },"subscription_events": {
                  Row: {
                    "amount_paid": number | null,"created_at": string,"ends_at": string | null,"event_type": string,"id": string,"method": string | null,"payload": NonNullable<Json>,"payment_ref": string | null,"plan_id": string | null,"school_id": string,"starts_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "amount_paid"?: number | null,"created_at"?: string,"ends_at"?: string | null,"event_type": string,"id"?: string,"method"?: string | null,"payload"?: NonNullable<Json>,"payment_ref"?: string | null,"plan_id"?: string | null,"school_id": string,"starts_at"?: string | null
                  }
                  Update: {
                    "amount_paid"?: number | null,"created_at"?: string,"ends_at"?: string | null,"event_type"?: string,"id"?: string,"method"?: string | null,"payload"?: NonNullable<Json>,"payment_ref"?: string | null,"plan_id"?: string | null,"school_id"?: string,"starts_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "subscription_events_school_id_fkey"
      columns: ["school_id"]
isOneToOne: false
      referencedRelation: "schools"
      referencedColumns: ["id"]
    }
                  ]
                },"subscriptions": {
                  Row: {
                    "amount_paid": number,"created_at": string,"ends_at": string | null,"id": string,"method": string | null,"paid_at": string | null,"payment_ref": string,"plan_id": string,"school_id": string,"starts_at": string | null,"student_limit": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "amount_paid"?: number,"created_at"?: string,"ends_at"?: string | null,"id"?: string,"method"?: string | null,"paid_at"?: string | null,"payment_ref"?: string,"plan_id": string,"school_id": string,"starts_at"?: string | null,"student_limit"?: number | null
                  }
                  Update: {
                    "amount_paid"?: number,"created_at"?: string,"ends_at"?: string | null,"id"?: string,"method"?: string | null,"paid_at"?: string | null,"payment_ref"?: string,"plan_id"?: string,"school_id"?: string,"starts_at"?: string | null,"student_limit"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "subscriptions_plan_id_fkey"
      columns: ["plan_id"]
isOneToOne: false
      referencedRelation: "plans"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "subscriptions_school_id_fkey"
      columns: ["school_id"]
isOneToOne: true
      referencedRelation: "schools"
      referencedColumns: ["id"]
    }
                  ]
                },"teachers": {
                  Row: {
                    "created_at": string,"email": string,"first_name": string,"id": string,"kind": string,"last_name": string,"phone": string,"school_id": string,"specialties": (string)[]
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"email": string,"first_name": string,"id"?: string,"kind": string,"last_name": string,"phone"?: string,"school_id": string,"specialties"?: (string)[]
                  }
                  Update: {
                    "created_at"?: string,"email"?: string,"first_name"?: string,"id"?: string,"kind"?: string,"last_name"?: string,"phone"?: string,"school_id"?: string,"specialties"?: (string)[]
                  }
                  Relationships: [
                    {
      foreignKeyName: "teachers_school_id_fkey"
      columns: ["school_id"]
isOneToOne: false
      referencedRelation: "schools"
      referencedColumns: ["id"]
    }
                  ]
                },"teaching_assignments": {
                  Row: {
                    "class_id": string,"created_at": string,"id": string,"school_id": string,"subject_id": string,"teacher_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "class_id": string,"created_at"?: string,"id"?: string,"school_id": string,"subject_id": string,"teacher_id": string
                  }
                  Update: {
                    "class_id"?: string,"created_at"?: string,"id"?: string,"school_id"?: string,"subject_id"?: string,"teacher_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "teaching_assignments_class_id_fkey"
      columns: ["class_id"]
isOneToOne: false
      referencedRelation: "class_rooms"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "teaching_assignments_school_id_fkey"
      columns: ["school_id"]
isOneToOne: false
      referencedRelation: "schools"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "teaching_assignments_subject_id_fkey"
      columns: ["subject_id"]
isOneToOne: false
      referencedRelation: "subjects"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "teaching_assignments_teacher_id_fkey"
      columns: ["teacher_id"]
isOneToOne: false
      referencedRelation: "teachers"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "admin_dashboard":
{ Args: { "p_period_id": string }; Returns: Json
                           },
"app_random_code":
{ Args: { "p_length": number }; Returns: string
                           },
"app_valid_cycles":
{ Args: { "cycles": (string)[] }; Returns: boolean
                           },
"apply_paid_installment":
{ Args: { "p_payload"?: Json,"p_provider": string,"p_provider_ref": string,"p_status": string }; Returns: Json
                           },
"apply_paid_subscription":
{ Args: { "p_payload"?: Json,"p_provider": string,"p_provider_ref": string,"p_status": string }; Returns: Json
                           },
"appreciation_for":
{ Args: { "v": number }; Returns: string
                           },
"assignment_conflicts":
{ Args: Record<PropertyKey, never>; Returns: {
              "class_id": string,"conflict_id": string,"message": string,"severity": string,"subject_id": string,"teacher_id": string
            }[]
                           },
"build_payment_plan":
{ Args: { "p_student_id": string }; Returns: number
                           },
"can_see_conversation":
{ Args: { "p_conversation_id": string }; Returns: boolean
                           },
"class_report_cards":
{ Args: { "p_class_id": string,"p_period": string }; Returns: Json
                           },
"complete_password_change":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"current_parent_id":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"current_role":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"current_school_id":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"current_student_id":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"current_teacher_id":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"decide_registration_requests":
{ Args: { "p_approve": boolean,"p_ids": (string)[],"p_reason"?: string }; Returns: number
                           },
"direction_can_write":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"enroll_student":
{ Args: { "p_birth_date": string,"p_class_id": string,"p_first_name": string,"p_gender": string,"p_last_name": string,"p_options": Json,"p_parent_address": string,"p_parent_email": string,"p_parent_first": string,"p_parent_id": string,"p_parent_last": string,"p_parent_phone": string }; Returns: Json
                           },
"finish_director_registration":
{ Args: { "p_city": string,"p_cycles": (string)[],"p_email": string,"p_first_name": string,"p_last_name": string,"p_phone": string,"p_school_name": string,"p_user_id": string }; Returns: string
                           },
"finish_parent_registration":
{ Args: { "p_child_code": string,"p_email": string,"p_first_name": string,"p_last_name": string,"p_phone": string,"p_school_id": string,"p_user_id": string }; Returns: Json
                           },
"finish_staff_registration":
{ Args: { "p_email": string,"p_first_name": string,"p_last_name": string,"p_phone": string,"p_role": string,"p_school_id": string,"p_specialties": (string)[],"p_user_id": string }; Returns: undefined
                           },
"finish_student_registration":
{ Args: { "p_birth_date": string,"p_class_id": string,"p_email": string,"p_first_name": string,"p_gender": string,"p_last_name": string,"p_phone": string,"p_school_id": string,"p_user_id": string }; Returns: Json
                           },
"generate_school_code":
{ Args: { "p_column": string,"p_length": number,"p_school_id": string }; Returns: string
                           },
"generate_school_matricule":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"grade_devoirs_average":
{ Args: { "p_d1": number,"p_d2": number }; Returns: number
                           },
"grade_subject_average":
{ Args: { "p_comp": number,"p_cycle": string,"p_d1": number,"p_d2": number }; Returns: number
                           },
"is_active_user":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"link_child":
{ Args: { "p_child_code": string }; Returns: string
                           },
"list_conversations":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"mark_conversation_read":
{ Args: { "p_conversation_id": string }; Returns: undefined
                           },
"message_actor_id":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"new_payment_reference":
{ Args: { "p_method": string }; Returns: string
                           },
"next_student_matricule":
{ Args: { "p_school_id": string,"p_school_year": string }; Returns: string
                           },
"open_classes":
{ Args: { "p_school_id": string }; Returns: {
              "capacity": number,"class_id": string,"cycle": unknown,"filled": number,"level_label": string,"name": string
            }[]
                           },
"password_changed":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"payment_status_of":
{ Args: { "p_amount": number,"p_due": string,"p_paid": number,"p_today"?: string }; Returns: unknown
                           },
"post_announcement":
{ Args: { "p_audience_all": boolean,"p_audience_roles": (string)[],"p_body": string,"p_title": string }; Returns: Json
                           },
"record_cash_payment":
{ Args: { "p_amount": number,"p_payment_id": string }; Returns: Json
                           },
"replace_cell_teachers":
{ Args: { "p_class_id": string,"p_subject_id": string,"p_teacher_ids": (string)[] }; Returns: undefined
                           },
"round2":
{ Args: { "v": number }; Returns: number
                           },
"save_grade":
{ Args: { "p_class_id": string,"p_field": string,"p_period": string,"p_student_id": string,"p_subject_id": string,"p_value": number }; Returns: undefined
                           },
"school_is_readable":
{ Args: { "p_school_id": string }; Returns: boolean
                           },
"school_is_writable":
{ Args: { "p_school_id": string }; Returns: boolean
                           },
"school_year_label":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"send_message":
{ Args: { "p_conversation_id": string,"p_text": string }; Returns: undefined
                           },
"send_reminders":
{ Args: { "p_student_ids": (string)[] }; Returns: number
                           },
"set_class_head_teacher":
{ Args: { "p_class_id": string,"p_mode": string,"p_teacher_id": string }; Returns: undefined
                           },
"start_conversation":
{ Args: { "p_parent_id": string,"p_student_id": string,"p_subject": string,"p_teacher_id": string,"p_text": string }; Returns: string
                           },
"start_installment_payments":
{ Args: { "p_method": string,"p_payment_ids": (string)[],"p_phone": string }; Returns: Json
                           },
"subscription_info":
{ Args: { "p_school_id": string }; Returns: Database["public"]['CompositeTypes']["subscription_info_result"]
                          SetofOptions: {
        from: "*"
        to: "subscription_info_result"
        isOneToOne: true
        isSetofReturn: false
      } },
"subscription_status_of":
{ Args: { "p_ends_at": string,"p_school_id": string,"p_today"?: string }; Returns: string
                           },
"update_report_meta":
{ Args: { "p_absences"?: number,"p_comment"?: string,"p_conduct"?: string,"p_period": string,"p_student_id": string }; Returns: undefined
                           },
"user_can_query_data":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"verify_matricule":
{ Args: { "p_matricule": string }; Returns: Json
                           },
"weighted_average":
{ Args: { "p_averages": (number)[],"p_coefficients": (number)[] }; Returns: number
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            "subscription_info_result": {
                        "status": string | null,"days_left": number | null,"read_only": boolean | null,"blocked": boolean | null,"student_limit": number | null,"active_students": number | null,"limit_reached": boolean | null,"plan_id": string | null,"plan_name": string | null
                      }
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
  "public": {
          Enums: {
            
          }
        }
} as const
