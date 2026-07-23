export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      api_keys: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          name: string
          org_id: string
          revoked_at: string | null
          scopes: string[]
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          name: string
          org_id: string
          revoked_at?: string | null
          scopes?: string[]
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          name?: string
          org_id?: string
          revoked_at?: string | null
          scopes?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "api_keys_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          entity: string | null
          entity_id: string | null
          id: string
          metadata: Json | null
          org_id: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          entity?: string | null
          entity_id?: string | null
          id?: string
          metadata?: Json | null
          org_id?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          entity?: string | null
          entity_id?: string | null
          id?: string
          metadata?: Json | null
          org_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      business_connections: {
        Row: {
          addressee_org_id: string
          created_at: string
          decided_at: string | null
          decided_by: string | null
          id: string
          message: string | null
          relationship_type: string
          requested_by: string | null
          requester_org_id: string
          status: string
          updated_at: string
        }
        Insert: {
          addressee_org_id: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          message?: string | null
          relationship_type?: string
          requested_by?: string | null
          requester_org_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          addressee_org_id?: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          message?: string | null
          relationship_type?: string
          requested_by?: string | null
          requester_org_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_connections_addressee_org_id_fkey"
            columns: ["addressee_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_connections_requester_org_id_fkey"
            columns: ["requester_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      deliveries: {
        Row: {
          actual_delivery: string | null
          created_at: string
          driver_name: string | null
          estimated_delivery: string | null
          id: string
          notes: string | null
          po_id: string
          receipt_notes: string | null
          received_at: string | null
          received_by: string | null
          status: Database["public"]["Enums"]["delivery_status"]
          tracking_number: string | null
          updated_at: string
        }
        Insert: {
          actual_delivery?: string | null
          created_at?: string
          driver_name?: string | null
          estimated_delivery?: string | null
          id?: string
          notes?: string | null
          po_id: string
          receipt_notes?: string | null
          received_at?: string | null
          received_by?: string | null
          status?: Database["public"]["Enums"]["delivery_status"]
          tracking_number?: string | null
          updated_at?: string
        }
        Update: {
          actual_delivery?: string | null
          created_at?: string
          driver_name?: string | null
          estimated_delivery?: string | null
          id?: string
          notes?: string | null
          po_id?: string
          receipt_notes?: string | null
          received_at?: string | null
          received_by?: string | null
          status?: Database["public"]["Enums"]["delivery_status"]
          tracking_number?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deliveries_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory: {
        Row: {
          batch_number: string | null
          created_at: string
          expiry_date: string | null
          id: string
          product_id: string
          quantity: number
          reorder_threshold: number
          updated_at: string
          warehouse_id: string
        }
        Insert: {
          batch_number?: string | null
          created_at?: string
          expiry_date?: string | null
          id?: string
          product_id: string
          quantity?: number
          reorder_threshold?: number
          updated_at?: string
          warehouse_id: string
        }
        Update: {
          batch_number?: string | null
          created_at?: string
          expiry_date?: string | null
          id?: string
          product_id?: string
          quantity?: number
          reorder_threshold?: number
          updated_at?: string
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          org_id: string
          role: Database["public"]["Enums"]["app_role"]
          status: Database["public"]["Enums"]["invitation_status"]
          token_hash: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          org_id: string
          role: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["invitation_status"]
          token_hash: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          org_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["invitation_status"]
          token_hash?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      join_requests: {
        Row: {
          created_at: string
          decided_at: string | null
          decided_by: string | null
          id: string
          message: string | null
          org_id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          message?: string | null
          org_id: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          message?: string | null
          org_id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "join_requests_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          created_at: string
          id: string
          org_id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          org_id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          org_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          address: string | null
          business_email: string | null
          city: string | null
          code: string | null
          contact_email: string | null
          contact_phone: string | null
          country: string | null
          created_at: string
          currency: string | null
          description: string | null
          id: string
          industry: string | null
          language: string | null
          logo_url: string | null
          name: string
          ownership: string | null
          phone: string | null
          province: string | null
          registration_number: string | null
          status: Database["public"]["Enums"]["org_status"]
          tax_number: string | null
          timezone: string | null
          type: string
          updated_at: string
          website: string | null
        }
        Insert: {
          address?: string | null
          business_email?: string | null
          city?: string | null
          code?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          country?: string | null
          created_at?: string
          currency?: string | null
          description?: string | null
          id?: string
          industry?: string | null
          language?: string | null
          logo_url?: string | null
          name: string
          ownership?: string | null
          phone?: string | null
          province?: string | null
          registration_number?: string | null
          status?: Database["public"]["Enums"]["org_status"]
          tax_number?: string | null
          timezone?: string | null
          type: string
          updated_at?: string
          website?: string | null
        }
        Update: {
          address?: string | null
          business_email?: string | null
          city?: string | null
          code?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          country?: string | null
          created_at?: string
          currency?: string | null
          description?: string | null
          id?: string
          industry?: string | null
          language?: string | null
          logo_url?: string | null
          name?: string
          ownership?: string | null
          phone?: string | null
          province?: string | null
          registration_number?: string | null
          status?: Database["public"]["Enums"]["org_status"]
          tax_number?: string | null
          timezone?: string | null
          type?: string
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      product_favourites: {
        Row: {
          created_at: string
          id: string
          product_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_favourites_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          barcode: string | null
          brand_name: string | null
          category: string | null
          created_at: string
          description: string | null
          dosage: string | null
          formulation: string | null
          generic_name: string | null
          id: string
          image_url: string | null
          is_active: boolean
          name: string
          packaging: string | null
          sku: string | null
          supplier_org_id: string
          unit_price: number
          updated_at: string
        }
        Insert: {
          barcode?: string | null
          brand_name?: string | null
          category?: string | null
          created_at?: string
          description?: string | null
          dosage?: string | null
          formulation?: string | null
          generic_name?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name: string
          packaging?: string | null
          sku?: string | null
          supplier_org_id: string
          unit_price?: number
          updated_at?: string
        }
        Update: {
          barcode?: string | null
          brand_name?: string | null
          category?: string | null
          created_at?: string
          description?: string | null
          dosage?: string | null
          formulation?: string | null
          generic_name?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name?: string
          packaging?: string | null
          sku?: string | null
          supplier_org_id?: string
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_supplier_org_id_fkey"
            columns: ["supplier_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          current_org_id: string | null
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_org_id?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_org_id?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_current_org_id_fkey"
            columns: ["current_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_order_items: {
        Row: {
          created_at: string
          id: string
          po_id: string
          product_id: string
          quantity: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          po_id: string
          product_id: string
          quantity: number
          unit_price?: number
        }
        Update: {
          created_at?: string
          id?: string
          po_id?: string
          product_id?: string
          quantity?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_items_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          buyer_org_id: string
          created_at: string
          created_by: string | null
          id: string
          invoice_date: string | null
          invoice_number: string | null
          notes: string | null
          payment_method: string | null
          payment_status: string
          payment_terms: string | null
          po_number: string
          quotation_id: string | null
          status: Database["public"]["Enums"]["po_status"]
          supplier_org_id: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          buyer_org_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          invoice_date?: string | null
          invoice_number?: string | null
          notes?: string | null
          payment_method?: string | null
          payment_status?: string
          payment_terms?: string | null
          po_number?: string
          quotation_id?: string | null
          status?: Database["public"]["Enums"]["po_status"]
          supplier_org_id: string
          total_amount?: number
          updated_at?: string
        }
        Update: {
          buyer_org_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          invoice_date?: string | null
          invoice_number?: string | null
          notes?: string | null
          payment_method?: string | null
          payment_status?: string
          payment_terms?: string | null
          po_number?: string
          quotation_id?: string | null
          status?: Database["public"]["Enums"]["po_status"]
          supplier_org_id?: string
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_buyer_org_id_fkey"
            columns: ["buyer_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_supplier_org_id_fkey"
            columns: ["supplier_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      quotation_items: {
        Row: {
          created_at: string
          description: string
          id: string
          line_total: number
          product_id: string | null
          quantity: number
          quotation_id: string
          rfq_item_id: string | null
          unit_price: number
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          line_total?: number
          product_id?: string | null
          quantity: number
          quotation_id: string
          rfq_item_id?: string | null
          unit_price?: number
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          line_total?: number
          product_id?: string | null
          quantity?: number
          quotation_id?: string
          rfq_item_id?: string | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "quotation_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotation_items_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "quotations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotation_items_rfq_item_id_fkey"
            columns: ["rfq_item_id"]
            isOneToOne: false
            referencedRelation: "rfq_items"
            referencedColumns: ["id"]
          },
        ]
      }
      quotations: {
        Row: {
          buyer_org_id: string
          created_at: string
          created_by: string | null
          currency: string
          decided_at: string | null
          decided_by: string | null
          delivery_terms: string | null
          id: string
          notes: string | null
          payment_terms: string | null
          quote_number: string | null
          rfq_id: string | null
          status: string
          subtotal: number
          supplier_org_id: string
          tax: number
          total: number
          updated_at: string
          valid_until: string | null
        }
        Insert: {
          buyer_org_id: string
          created_at?: string
          created_by?: string | null
          currency?: string
          decided_at?: string | null
          decided_by?: string | null
          delivery_terms?: string | null
          id?: string
          notes?: string | null
          payment_terms?: string | null
          quote_number?: string | null
          rfq_id?: string | null
          status?: string
          subtotal?: number
          supplier_org_id: string
          tax?: number
          total?: number
          updated_at?: string
          valid_until?: string | null
        }
        Update: {
          buyer_org_id?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          decided_at?: string | null
          decided_by?: string | null
          delivery_terms?: string | null
          id?: string
          notes?: string | null
          payment_terms?: string | null
          quote_number?: string | null
          rfq_id?: string | null
          status?: string
          subtotal?: number
          supplier_org_id?: string
          tax?: number
          total?: number
          updated_at?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quotations_buyer_org_id_fkey"
            columns: ["buyer_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotations_rfq_id_fkey"
            columns: ["rfq_id"]
            isOneToOne: false
            referencedRelation: "rfqs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotations_supplier_org_id_fkey"
            columns: ["supplier_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      rfq_items: {
        Row: {
          brand_preference: string | null
          category: string | null
          created_at: string
          description: string
          id: string
          product_id: string | null
          quantity: number
          rfq_id: string
          specifications: string | null
          unit_hint: string | null
        }
        Insert: {
          brand_preference?: string | null
          category?: string | null
          created_at?: string
          description: string
          id?: string
          product_id?: string | null
          quantity: number
          rfq_id: string
          specifications?: string | null
          unit_hint?: string | null
        }
        Update: {
          brand_preference?: string | null
          category?: string | null
          created_at?: string
          description?: string
          id?: string
          product_id?: string | null
          quantity?: number
          rfq_id?: string
          specifications?: string | null
          unit_hint?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rfq_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfq_items_rfq_id_fkey"
            columns: ["rfq_id"]
            isOneToOne: false
            referencedRelation: "rfqs"
            referencedColumns: ["id"]
          },
        ]
      }
      rfqs: {
        Row: {
          buyer_org_id: string
          cold_chain_required: boolean
          created_at: string
          created_by: string | null
          delivery_location: string | null
          id: string
          needed_by: string | null
          notes: string | null
          priority: string
          rfq_number: string | null
          status: string
          supplier_org_id: string
          updated_at: string
        }
        Insert: {
          buyer_org_id: string
          cold_chain_required?: boolean
          created_at?: string
          created_by?: string | null
          delivery_location?: string | null
          id?: string
          needed_by?: string | null
          notes?: string | null
          priority?: string
          rfq_number?: string | null
          status?: string
          supplier_org_id: string
          updated_at?: string
        }
        Update: {
          buyer_org_id?: string
          cold_chain_required?: boolean
          created_at?: string
          created_by?: string | null
          delivery_location?: string | null
          id?: string
          needed_by?: string | null
          notes?: string | null
          priority?: string
          rfq_number?: string | null
          status?: string
          supplier_org_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rfqs_buyer_org_id_fkey"
            columns: ["buyer_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfqs_supplier_org_id_fkey"
            columns: ["supplier_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_reviews: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          rating: number
          reviewer_org_id: string
          reviewer_user_id: string
          supplier_org_id: string
          title: string | null
          updated_at: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          rating: number
          reviewer_org_id: string
          reviewer_user_id: string
          supplier_org_id: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          rating?: number
          reviewer_org_id?: string
          reviewer_user_id?: string
          supplier_org_id?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_reviews_reviewer_org_id_fkey"
            columns: ["reviewer_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_reviews_supplier_org_id_fkey"
            columns: ["supplier_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      warehouses: {
        Row: {
          capacity: number | null
          created_at: string
          id: string
          location: string | null
          name: string
          org_id: string
          updated_at: string
        }
        Insert: {
          capacity?: number | null
          created_at?: string
          id?: string
          location?: string | null
          name: string
          org_id: string
          updated_at?: string
        }
        Update: {
          capacity?: number | null
          created_at?: string
          id?: string
          location?: string | null
          name?: string
          org_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "warehouses_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      supplier_rating_stats: {
        Row: {
          avg_rating: number | null
          review_count: number | null
          supplier_org_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_reviews_supplier_org_id_fkey"
            columns: ["supplier_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      accept_invitation: {
        Args: { _token_hash: string }
        Returns: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          org_id: string
          role: Database["public"]["Enums"]["app_role"]
          status: Database["public"]["Enums"]["invitation_status"]
          token_hash: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "invitations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_organization_with_admin: {
        Args: {
          _address?: string
          _business_email?: string
          _city?: string
          _country?: string
          _industry?: string
          _logo_url?: string
          _name: string
          _phone?: string
          _province?: string
          _registration_number?: string
          _tax_number?: string
          _type: string
          _website?: string
        }
        Returns: {
          address: string | null
          business_email: string | null
          city: string | null
          code: string | null
          contact_email: string | null
          contact_phone: string | null
          country: string | null
          created_at: string
          currency: string | null
          description: string | null
          id: string
          industry: string | null
          language: string | null
          logo_url: string | null
          name: string
          ownership: string | null
          phone: string | null
          province: string | null
          registration_number: string | null
          status: Database["public"]["Enums"]["org_status"]
          tax_number: string | null
          timezone: string | null
          type: string
          updated_at: string
          website: string | null
        }
        SetofOptions: {
          from: "*"
          to: "organizations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_rfq:
        | {
            Args: {
              _items?: Json
              _needed_by?: string
              _notes?: string
              _send?: boolean
              _supplier_org: string
            }
            Returns: {
              buyer_org_id: string
              cold_chain_required: boolean
              created_at: string
              created_by: string | null
              delivery_location: string | null
              id: string
              needed_by: string | null
              notes: string | null
              priority: string
              rfq_number: string | null
              status: string
              supplier_org_id: string
              updated_at: string
            }
            SetofOptions: {
              from: "*"
              to: "rfqs"
              isOneToOne: true
              isSetofReturn: false
            }
          }
        | {
            Args: {
              _cold_chain?: boolean
              _delivery_location?: string
              _items?: Json
              _needed_by?: string
              _notes?: string
              _priority?: string
              _send?: boolean
              _supplier_org: string
            }
            Returns: {
              buyer_org_id: string
              cold_chain_required: boolean
              created_at: string
              created_by: string | null
              delivery_location: string | null
              id: string
              needed_by: string | null
              notes: string | null
              priority: string
              rfq_number: string | null
              status: string
              supplier_org_id: string
              updated_at: string
            }
            SetofOptions: {
              from: "*"
              to: "rfqs"
              isOneToOne: true
              isSetofReturn: false
            }
          }
      decide_business_connection: {
        Args: { _accept: boolean; _id: string }
        Returns: {
          addressee_org_id: string
          created_at: string
          decided_at: string | null
          decided_by: string | null
          id: string
          message: string | null
          relationship_type: string
          requested_by: string | null
          requester_org_id: string
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "business_connections"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      decide_join_request: {
        Args: {
          _approve: boolean
          _request_id: string
          _role?: Database["public"]["Enums"]["app_role"]
        }
        Returns: {
          created_at: string
          decided_at: string | null
          decided_by: string | null
          id: string
          message: string | null
          org_id: string
          status: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "join_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      decide_quotation: {
        Args: { _accept: boolean; _quotation_id: string }
        Returns: {
          buyer_org_id: string
          created_at: string
          created_by: string | null
          currency: string
          decided_at: string | null
          decided_by: string | null
          delivery_terms: string | null
          id: string
          notes: string | null
          payment_terms: string | null
          quote_number: string | null
          rfq_id: string | null
          status: string
          subtotal: number
          supplier_org_id: string
          tax: number
          total: number
          updated_at: string
          valid_until: string | null
        }
        SetofOptions: {
          from: "*"
          to: "quotations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_invitation_by_token: {
        Args: { _token_hash: string }
        Returns: {
          email: string
          expires_at: string
          id: string
          org_id: string
          org_name: string
          role: Database["public"]["Enums"]["app_role"]
          status: Database["public"]["Enums"]["invitation_status"]
        }[]
      }
      has_role: {
        Args: {
          _org: string
          _role: Database["public"]["Enums"]["app_role"]
          _user: string
        }
        Returns: boolean
      }
      is_org_member: { Args: { _org: string; _user: string }; Returns: boolean }
      is_super_admin: { Args: { _user: string }; Returns: boolean }
      remove_business_connection: {
        Args: { _id: string }
        Returns: {
          addressee_org_id: string
          created_at: string
          decided_at: string | null
          decided_by: string | null
          id: string
          message: string | null
          relationship_type: string
          requested_by: string | null
          requester_org_id: string
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "business_connections"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      request_business_connection: {
        Args: {
          _addressee_org_id: string
          _message?: string
          _relationship_type?: string
        }
        Returns: {
          addressee_org_id: string
          created_at: string
          decided_at: string | null
          decided_by: string | null
          id: string
          message: string | null
          relationship_type: string
          requested_by: string | null
          requester_org_id: string
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "business_connections"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      request_join_by_code: {
        Args: { _code: string; _message?: string }
        Returns: {
          created_at: string
          decided_at: string | null
          decided_by: string | null
          id: string
          message: string | null
          org_id: string
          status: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "join_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      search_organizations: {
        Args: {
          _country?: string
          _industry?: string
          _limit?: number
          _province?: string
          _q?: string
          _type?: string
        }
        Returns: {
          city: string
          code: string
          country: string
          description: string
          id: string
          industry: string
          logo_url: string
          name: string
          ownership: string
          province: string
          status: string
          type: string
        }[]
      }
      send_rfq: {
        Args: { _rfq_id: string }
        Returns: {
          buyer_org_id: string
          cold_chain_required: boolean
          created_at: string
          created_by: string | null
          delivery_location: string | null
          id: string
          needed_by: string | null
          notes: string | null
          priority: string
          rfq_number: string | null
          status: string
          supplier_org_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "rfqs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      submit_quotation: {
        Args: {
          _delivery_terms?: string
          _items: Json
          _notes?: string
          _payment_terms?: string
          _rfq_id: string
          _tax?: number
          _valid_until?: string
        }
        Returns: {
          buyer_org_id: string
          created_at: string
          created_by: string | null
          currency: string
          decided_at: string | null
          decided_by: string | null
          delivery_terms: string | null
          id: string
          notes: string | null
          payment_terms: string | null
          quote_number: string | null
          rfq_id: string | null
          status: string
          subtotal: number
          supplier_org_id: string
          tax: number
          total: number
          updated_at: string
          valid_until: string | null
        }
        SetofOptions: {
          from: "*"
          to: "quotations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_organization_settings: {
        Args: {
          _address?: string
          _business_email?: string
          _city?: string
          _country?: string
          _currency?: string
          _industry?: string
          _language?: string
          _logo_url?: string
          _name?: string
          _org_id: string
          _phone?: string
          _province?: string
          _registration_number?: string
          _tax_number?: string
          _timezone?: string
          _type?: string
          _website?: string
        }
        Returns: {
          address: string | null
          business_email: string | null
          city: string | null
          code: string | null
          contact_email: string | null
          contact_phone: string | null
          country: string | null
          created_at: string
          currency: string | null
          description: string | null
          id: string
          industry: string | null
          language: string | null
          logo_url: string | null
          name: string
          ownership: string | null
          phone: string | null
          province: string | null
          registration_number: string | null
          status: Database["public"]["Enums"]["org_status"]
          tax_number: string | null
          timezone: string | null
          type: string
          updated_at: string
          website: string | null
        }
        SetofOptions: {
          from: "*"
          to: "organizations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      withdraw_quotation: {
        Args: { _quotation_id: string }
        Returns: {
          buyer_org_id: string
          created_at: string
          created_by: string | null
          currency: string
          decided_at: string | null
          decided_by: string | null
          delivery_terms: string | null
          id: string
          notes: string | null
          payment_terms: string | null
          quote_number: string | null
          rfq_id: string | null
          status: string
          subtotal: number
          supplier_org_id: string
          tax: number
          total: number
          updated_at: string
          valid_until: string | null
        }
        SetofOptions: {
          from: "*"
          to: "quotations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      app_role:
        | "super_admin"
        | "support_admin"
        | "compliance_admin"
        | "supplier_admin"
        | "warehouse_manager"
        | "delivery_manager"
        | "supplier_staff"
        | "clinic_admin"
        | "hospital_admin"
        | "pharmacist"
        | "inventory_manager"
        | "procurement_officer"
        | "org_admin"
      delivery_status:
        | "pending"
        | "processing"
        | "packed"
        | "in_transit"
        | "delivered"
        | "delayed"
        | "cancelled"
      invitation_status: "pending" | "accepted" | "expired" | "revoked"
      org_status: "pending" | "verified" | "suspended" | "archived"
      org_type:
        | "clinic"
        | "hospital"
        | "pharmacy"
        | "supplier"
        | "warehouse"
        | "distributor"
      po_status:
        | "draft"
        | "submitted"
        | "under_review"
        | "approved"
        | "processing"
        | "dispatched"
        | "delivered"
        | "cancelled"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "super_admin",
        "support_admin",
        "compliance_admin",
        "supplier_admin",
        "warehouse_manager",
        "delivery_manager",
        "supplier_staff",
        "clinic_admin",
        "hospital_admin",
        "pharmacist",
        "inventory_manager",
        "procurement_officer",
        "org_admin",
      ],
      delivery_status: [
        "pending",
        "processing",
        "packed",
        "in_transit",
        "delivered",
        "delayed",
        "cancelled",
      ],
      invitation_status: ["pending", "accepted", "expired", "revoked"],
      org_status: ["pending", "verified", "suspended", "archived"],
      org_type: [
        "clinic",
        "hospital",
        "pharmacy",
        "supplier",
        "warehouse",
        "distributor",
      ],
      po_status: [
        "draft",
        "submitted",
        "under_review",
        "approved",
        "processing",
        "dispatched",
        "delivered",
        "cancelled",
      ],
    },
  },
} as const
