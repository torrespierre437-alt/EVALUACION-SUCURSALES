// Tipos mínimos a mano, alineados con supabase/migrations/0001_schema.sql.
// Si más adelante corres `supabase gen types typescript`, puedes reemplazar este archivo.

export type EvaluationPeriod = "inicial" | "seguimiento";
export type EvaluationStatus = "pendiente" | "a_tiempo" | "tardio" | "no_enviado";
export type FollowupStatus = "pendiente" | "resuelto";
export type Role = "admin" | "branch";

export interface Branch {
  id: string;
  code: string;
  name: string;
  created_at: string;
}

export interface Category {
  id: string;
  name: string;
  sort_order: number;
}

export interface ChecklistItem {
  id: string;
  category_id: string;
  description: string;
  weight: number;
  active: boolean;
  sort_order: number;
}

export interface Evaluation {
  id: string;
  branch_id: string;
  period: EvaluationPeriod;
  month: number;
  year: number;
  due_date: string;
  submitted_at: string | null;
  days_late: number;
  punctuality_score: number | null;
  evaluation_score: number | null;
  status: EvaluationStatus;
  signature_url: string | null;
  created_at: string;
}

export interface EvaluationAnswer {
  id: string;
  evaluation_id: string;
  checklist_item_id: string;
  value: 0 | 1;
  comment: string | null;
  photo_url: string | null;
}

export interface Followup {
  id: string;
  branch_id: string;
  origin_evaluation_id: string | null;
  checklist_item_id: string | null;
  description: string;
  status: FollowupStatus;
  created_at: string;
  last_note_at?: string | null;
  last_note?: string | null;
}

export interface FollowupNote {
  id: string;
  followup_id: string;
  note: string;
  noted_at: string;
  created_by: string | null;
}

export interface Profile {
  id: string;
  role: Role;
  branch_id: string | null;
  full_name: string | null;
  email: string | null;
  push_subscription: unknown | null;
  created_at: string;
}
