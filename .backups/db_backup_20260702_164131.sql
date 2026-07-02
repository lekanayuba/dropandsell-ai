--
-- PostgreSQL database dump
--

\restrict mrsZLasWCyttzivxGYuvOtGWdffOvNa2lQ1t1ekNbcsYAM4LJQzV8DdTybenrBi

-- Dumped from database version 16.10
-- Dumped by pg_dump version 16.10

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: addon_catalog; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.addon_catalog (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    name character varying NOT NULL,
    description text,
    price numeric DEFAULT 0,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    image text,
    category text DEFAULT 'general'::text NOT NULL,
    is_new boolean DEFAULT false NOT NULL
);


ALTER TABLE public.addon_catalog OWNER TO postgres;

--
-- Name: addon_purchases; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.addon_purchases (
    id integer NOT NULL,
    user_id character varying NOT NULL,
    addon_id character varying NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    stripe_payment_id character varying,
    purchased_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.addon_purchases OWNER TO postgres;

--
-- Name: addon_purchases_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.addon_purchases_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.addon_purchases_id_seq OWNER TO postgres;

--
-- Name: addon_purchases_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.addon_purchases_id_seq OWNED BY public.addon_purchases.id;


--
-- Name: admin_settings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.admin_settings (
    id integer NOT NULL,
    site_name text DEFAULT 'DropandSell AI'::text,
    maintenance_mode boolean DEFAULT false,
    allow_new_registrations boolean DEFAULT true,
    default_subscription_plan text DEFAULT 'free'::text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.admin_settings OWNER TO postgres;

--
-- Name: admin_settings_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.admin_settings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.admin_settings_id_seq OWNER TO postgres;

--
-- Name: admin_settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.admin_settings_id_seq OWNED BY public.admin_settings.id;


--
-- Name: app_settings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.app_settings (
    id integer NOT NULL,
    key text NOT NULL,
    value text NOT NULL,
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.app_settings OWNER TO postgres;

--
-- Name: app_settings_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.app_settings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.app_settings_id_seq OWNER TO postgres;

--
-- Name: app_settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.app_settings_id_seq OWNED BY public.app_settings.id;


--
-- Name: app_state; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.app_state (
    key text NOT NULL,
    value text,
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.app_state OWNER TO postgres;

--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.audit_logs (
    id integer NOT NULL,
    user_id character varying NOT NULL,
    order_id integer,
    action text NOT NULL,
    source text,
    vendor_used text,
    payment_method text,
    fulfillment_status text,
    details jsonb,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.audit_logs OWNER TO postgres;

--
-- Name: audit_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.audit_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.audit_logs_id_seq OWNER TO postgres;

--
-- Name: audit_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.audit_logs_id_seq OWNED BY public.audit_logs.id;


--
-- Name: broadcast_campaign_log; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.broadcast_campaign_log (
    broadcast_date date NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.broadcast_campaign_log OWNER TO postgres;

--
-- Name: catalog_refresh_log; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.catalog_refresh_log (
    id integer NOT NULL,
    items_added integer DEFAULT 0 NOT NULL,
    items_updated integer DEFAULT 0 NOT NULL,
    last_refreshed_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.catalog_refresh_log OWNER TO postgres;

--
-- Name: catalog_refresh_log_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.catalog_refresh_log_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.catalog_refresh_log_id_seq OWNER TO postgres;

--
-- Name: catalog_refresh_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.catalog_refresh_log_id_seq OWNED BY public.catalog_refresh_log.id;


--
-- Name: content_filters; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.content_filters (
    id integer NOT NULL,
    user_id character varying NOT NULL,
    type text NOT NULL,
    pattern text,
    description text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.content_filters OWNER TO postgres;

--
-- Name: content_filters_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.content_filters_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.content_filters_id_seq OWNER TO postgres;

--
-- Name: content_filters_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.content_filters_id_seq OWNED BY public.content_filters.id;


--
-- Name: conversations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.conversations (
    id integer NOT NULL,
    title text NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    user_id character varying
);


ALTER TABLE public.conversations OWNER TO postgres;

--
-- Name: conversations_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.conversations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.conversations_id_seq OWNER TO postgres;

--
-- Name: conversations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.conversations_id_seq OWNED BY public.conversations.id;


--
-- Name: drop_and_sell_orders; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.drop_and_sell_orders (
    id integer NOT NULL,
    user_id character varying NOT NULL,
    listing_count integer NOT NULL,
    total_price numeric(10,2) NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    freelancer_id integer,
    assigned_at timestamp without time zone,
    completed_at timestamp without time zone,
    payment_status text DEFAULT 'unpaid'::text NOT NULL,
    stripe_session_id text,
    notes text,
    delivery_summary jsonb,
    user_feedback text,
    user_rating integer,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    store_id integer,
    lister_earnings numeric(10,2) DEFAULT 0.00 NOT NULL,
    platform_fee numeric(10,2) DEFAULT 0.00 NOT NULL,
    deadline timestamp without time zone,
    progress_count integer DEFAULT 0 NOT NULL,
    payout_status text DEFAULT 'pending'::text NOT NULL,
    categories text[] DEFAULT '{}'::text[],
    default_quantity integer DEFAULT 1,
    price_preference text,
    preferred_vendors text[] DEFAULT ARRAY[]::text[],
    profit_margin_percent integer
);


ALTER TABLE public.drop_and_sell_orders OWNER TO postgres;

--
-- Name: drop_and_sell_orders_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.drop_and_sell_orders_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.drop_and_sell_orders_id_seq OWNER TO postgres;

--
-- Name: drop_and_sell_orders_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.drop_and_sell_orders_id_seq OWNED BY public.drop_and_sell_orders.id;


--
-- Name: feature_flags; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.feature_flags (
    id integer NOT NULL,
    feature_key text NOT NULL,
    name text NOT NULL,
    description text,
    is_enabled boolean DEFAULT false NOT NULL,
    admin_only boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    metadata jsonb
);


ALTER TABLE public.feature_flags OWNER TO postgres;

--
-- Name: feature_flags_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.feature_flags_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.feature_flags_id_seq OWNER TO postgres;

--
-- Name: feature_flags_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.feature_flags_id_seq OWNED BY public.feature_flags.id;


--
-- Name: freelancer_profiles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.freelancer_profiles (
    id integer NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    specialties text[],
    rating numeric(3,2) DEFAULT 5.00,
    completed_jobs integer DEFAULT 0 NOT NULL,
    is_available boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    user_id character varying,
    wallet_balance numeric(10,2) DEFAULT 0.00 NOT NULL,
    total_earnings numeric(10,2) DEFAULT 0.00 NOT NULL,
    stripe_connect_id text,
    active_job_count integer DEFAULT 0 NOT NULL,
    years_experience text,
    has_community boolean DEFAULT false,
    community_name text,
    referrals_made integer DEFAULT 0,
    application_status text DEFAULT 'approved'::text
);


ALTER TABLE public.freelancer_profiles OWNER TO postgres;

--
-- Name: freelancer_profiles_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.freelancer_profiles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.freelancer_profiles_id_seq OWNER TO postgres;

--
-- Name: freelancer_profiles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.freelancer_profiles_id_seq OWNED BY public.freelancer_profiles.id;


--
-- Name: fulfillment_jobs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.fulfillment_jobs (
    id integer NOT NULL,
    user_id character varying NOT NULL,
    order_id integer NOT NULL,
    sku_mapping_id integer,
    vendor_id integer,
    vendor_name text,
    vendor_order_id text,
    status text DEFAULT 'pending'::text NOT NULL,
    tracking_number text,
    carrier text,
    payment_method text,
    payment_status text,
    amount_charged numeric(10,2),
    error_message text,
    retry_count integer DEFAULT 0 NOT NULL,
    sourcing_type text DEFAULT 'primary'::text,
    created_at timestamp without time zone DEFAULT now(),
    fulfilled_at timestamp without time zone,
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.fulfillment_jobs OWNER TO postgres;

--
-- Name: fulfillment_jobs_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.fulfillment_jobs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.fulfillment_jobs_id_seq OWNER TO postgres;

--
-- Name: fulfillment_jobs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.fulfillment_jobs_id_seq OWNED BY public.fulfillment_jobs.id;


--
-- Name: global_vero_list; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.global_vero_list (
    id integer NOT NULL,
    type text DEFAULT 'brand'::text NOT NULL,
    value text NOT NULL,
    platform text,
    reason text,
    category text,
    severity text DEFAULT 'block'::text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.global_vero_list OWNER TO postgres;

--
-- Name: global_vero_list_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.global_vero_list_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.global_vero_list_id_seq OWNER TO postgres;

--
-- Name: global_vero_list_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.global_vero_list_id_seq OWNED BY public.global_vero_list.id;


--
-- Name: import_jobs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.import_jobs (
    id integer NOT NULL,
    user_id character varying NOT NULL,
    vendor_id integer,
    source text NOT NULL,
    file_name text,
    field_mapping jsonb,
    status text DEFAULT 'pending'::text NOT NULL,
    total_rows integer DEFAULT 0,
    processed_rows integer DEFAULT 0,
    success_count integer DEFAULT 0,
    error_count integer DEFAULT 0,
    errors jsonb,
    created_at timestamp without time zone DEFAULT now(),
    completed_at timestamp without time zone
);


ALTER TABLE public.import_jobs OWNER TO postgres;

--
-- Name: import_jobs_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.import_jobs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.import_jobs_id_seq OWNER TO postgres;

--
-- Name: import_jobs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.import_jobs_id_seq OWNED BY public.import_jobs.id;


--
-- Name: marketplace_listings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.marketplace_listings (
    id integer NOT NULL,
    store_id integer NOT NULL,
    product_id integer,
    external_id text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    sync_status text DEFAULT 'synced'::text,
    last_sync timestamp without time zone,
    listing_url text,
    stock_status text DEFAULT 'in_stock'::text,
    out_of_stock_at timestamp without time zone
);


ALTER TABLE public.marketplace_listings OWNER TO postgres;

--
-- Name: marketplace_listings_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.marketplace_listings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.marketplace_listings_id_seq OWNER TO postgres;

--
-- Name: marketplace_listings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.marketplace_listings_id_seq OWNED BY public.marketplace_listings.id;


--
-- Name: messages; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.messages (
    id integer NOT NULL,
    conversation_id integer NOT NULL,
    role text NOT NULL,
    content text NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.messages OWNER TO postgres;

--
-- Name: messages_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.messages_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.messages_id_seq OWNER TO postgres;

--
-- Name: messages_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.messages_id_seq OWNED BY public.messages.id;


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.notifications (
    id integer NOT NULL,
    user_id character varying NOT NULL,
    type text DEFAULT 'info'::text NOT NULL,
    title text NOT NULL,
    message text,
    order_id integer,
    read boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.notifications OWNER TO postgres;

--
-- Name: notifications_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.notifications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.notifications_id_seq OWNER TO postgres;

--
-- Name: notifications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.notifications_id_seq OWNED BY public.notifications.id;


--
-- Name: orders; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.orders (
    id integer NOT NULL,
    user_id character varying NOT NULL,
    store_id integer,
    external_order_id text,
    customer_name text,
    customer_email text,
    shipping_address jsonb,
    total_amount numeric(10,2),
    status text DEFAULT 'pending'::text NOT NULL,
    fulfillment_status text DEFAULT 'unfulfilled'::text,
    tracking_number text,
    carrier text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    line_items jsonb,
    tracking_status text DEFAULT 'pending'::text,
    tracking_url text,
    tracking_updated_at timestamp without time zone
);


ALTER TABLE public.orders OWNER TO postgres;

--
-- Name: orders_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.orders_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.orders_id_seq OWNER TO postgres;

--
-- Name: orders_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.orders_id_seq OWNED BY public.orders.id;


--
-- Name: payment_cards; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.payment_cards (
    id integer NOT NULL,
    user_id character varying NOT NULL,
    last_four character varying(4) NOT NULL,
    brand text NOT NULL,
    expiry_month integer NOT NULL,
    expiry_year integer NOT NULL,
    tokenized_id text NOT NULL,
    is_default boolean DEFAULT false NOT NULL,
    priority integer DEFAULT 0 NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.payment_cards OWNER TO postgres;

--
-- Name: payment_cards_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.payment_cards_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.payment_cards_id_seq OWNER TO postgres;

--
-- Name: payment_cards_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.payment_cards_id_seq OWNED BY public.payment_cards.id;


--
-- Name: paypal_payout_accruals; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.paypal_payout_accruals (
    id integer NOT NULL,
    user_id character varying NOT NULL,
    recipient_handle text NOT NULL,
    month_year text NOT NULL,
    amount_pence integer DEFAULT 10 NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    settled_at timestamp without time zone,
    settled_by_user_id character varying,
    settled_note text,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.paypal_payout_accruals OWNER TO postgres;

--
-- Name: paypal_payout_accruals_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.paypal_payout_accruals_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.paypal_payout_accruals_id_seq OWNER TO postgres;

--
-- Name: paypal_payout_accruals_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.paypal_payout_accruals_id_seq OWNED BY public.paypal_payout_accruals.id;


--
-- Name: pricing_rules; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.pricing_rules (
    id integer NOT NULL,
    user_id character varying NOT NULL,
    name text NOT NULL,
    rule_type text DEFAULT 'markup'::text NOT NULL,
    value numeric(10,2) NOT NULL,
    min_price numeric(10,2),
    max_price numeric(10,2),
    apply_to_vendor integer,
    apply_to_category text,
    priority integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.pricing_rules OWNER TO postgres;

--
-- Name: pricing_rules_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.pricing_rules_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.pricing_rules_id_seq OWNER TO postgres;

--
-- Name: pricing_rules_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.pricing_rules_id_seq OWNED BY public.pricing_rules.id;


--
-- Name: product_variations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.product_variations (
    id integer NOT NULL,
    product_id integer NOT NULL,
    name text NOT NULL,
    sku text NOT NULL,
    price numeric(10,2) NOT NULL,
    stock integer DEFAULT 0 NOT NULL,
    image text,
    attributes jsonb,
    external_id text,
    sort_order integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.product_variations OWNER TO postgres;

--
-- Name: product_variations_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.product_variations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.product_variations_id_seq OWNER TO postgres;

--
-- Name: product_variations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.product_variations_id_seq OWNED BY public.product_variations.id;


--
-- Name: products; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.products (
    id integer NOT NULL,
    user_id character varying NOT NULL,
    vendor_id integer,
    title text NOT NULL,
    description text,
    sku text NOT NULL,
    cost_price numeric(10,2) NOT NULL,
    selling_price numeric(10,2) NOT NULL,
    quantity integer DEFAULT 0 NOT NULL,
    images text[],
    attributes jsonb,
    vero_status text DEFAULT 'clean'::text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    delivery_type text DEFAULT 'buyer_pays'::text,
    delivery_cost numeric(10,2) DEFAULT 0,
    brand text DEFAULT ''::text,
    vero_override boolean DEFAULT false,
    vero_override_by text,
    vero_override_reason text,
    listed_by_freelancer_id integer,
    external_product_id text,
    marketplace_price numeric(10,2),
    marketplace_stock_status text DEFAULT 'unknown'::text,
    shipping_info jsonb,
    last_marketplace_sync timestamp without time zone
);


ALTER TABLE public.products OWNER TO postgres;

--
-- Name: products_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.products_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.products_id_seq OWNER TO postgres;

--
-- Name: products_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.products_id_seq OWNED BY public.products.id;


--
-- Name: publish_queue; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.publish_queue (
    id integer NOT NULL,
    user_id character varying NOT NULL,
    product_id integer NOT NULL,
    store_id integer NOT NULL,
    calculated_price numeric(10,2) NOT NULL,
    pricing_rule_id integer,
    status text DEFAULT 'pending'::text NOT NULL,
    error_message text,
    scheduled_at timestamp without time zone,
    published_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now(),
    quantity integer DEFAULT 1 NOT NULL,
    ai_description text,
    postage_type text DEFAULT 'store_default'::text,
    postage_cost numeric(10,2)
);


ALTER TABLE public.publish_queue OWNER TO postgres;

--
-- Name: publish_queue_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.publish_queue_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.publish_queue_id_seq OWNER TO postgres;

--
-- Name: publish_queue_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.publish_queue_id_seq OWNED BY public.publish_queue.id;


--
-- Name: referrals; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.referrals (
    id integer NOT NULL,
    referrer_id character varying NOT NULL,
    referred_user_id character varying NOT NULL,
    status text DEFAULT 'pending'::text,
    total_earnings numeric(10,2) DEFAULT 0.00,
    created_at timestamp without time zone DEFAULT now(),
    cycles_credited integer DEFAULT 0
);


ALTER TABLE public.referrals OWNER TO postgres;

--
-- Name: referrals_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.referrals_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.referrals_id_seq OWNER TO postgres;

--
-- Name: referrals_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.referrals_id_seq OWNED BY public.referrals.id;


--
-- Name: restock_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.restock_logs (
    id integer NOT NULL,
    store_id integer NOT NULL,
    product_id integer NOT NULL,
    previous_quantity integer NOT NULL,
    new_quantity integer NOT NULL,
    marketplace_listing_id integer,
    triggered_by text DEFAULT 'auto'::text NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.restock_logs OWNER TO postgres;

--
-- Name: restock_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.restock_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.restock_logs_id_seq OWNER TO postgres;

--
-- Name: restock_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.restock_logs_id_seq OWNED BY public.restock_logs.id;


--
-- Name: restricted_products; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.restricted_products (
    id integer NOT NULL,
    user_id character varying NOT NULL,
    category text NOT NULL,
    keyword text NOT NULL,
    jurisdiction text,
    reason text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.restricted_products OWNER TO postgres;

--
-- Name: restricted_products_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.restricted_products_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.restricted_products_id_seq OWNER TO postgres;

--
-- Name: restricted_products_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.restricted_products_id_seq OWNED BY public.restricted_products.id;


--
-- Name: return_requests; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.return_requests (
    id integer NOT NULL,
    user_id character varying NOT NULL,
    order_id integer NOT NULL,
    fulfillment_job_id integer,
    reason text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    vendor_return_id text,
    refund_amount numeric(10,2),
    notes text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.return_requests OWNER TO postgres;

--
-- Name: return_requests_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.return_requests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.return_requests_id_seq OWNER TO postgres;

--
-- Name: return_requests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.return_requests_id_seq OWNED BY public.return_requests.id;


--
-- Name: sessions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.sessions (
    sid character varying NOT NULL,
    sess jsonb NOT NULL,
    expire timestamp without time zone NOT NULL
);


ALTER TABLE public.sessions OWNER TO postgres;

--
-- Name: shipping_profiles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.shipping_profiles (
    id integer NOT NULL,
    user_id character varying NOT NULL,
    name text NOT NULL,
    carrier text DEFAULT 'other'::text NOT NULL,
    service_level text DEFAULT 'standard'::text NOT NULL,
    base_rate numeric(10,2) DEFAULT '0'::numeric NOT NULL,
    rate_per_kg numeric(10,2),
    free_shipping_threshold numeric(10,2),
    estimated_days_min integer DEFAULT 3,
    estimated_days_max integer DEFAULT 7,
    regions text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.shipping_profiles OWNER TO postgres;

--
-- Name: shipping_profiles_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.shipping_profiles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.shipping_profiles_id_seq OWNER TO postgres;

--
-- Name: shipping_profiles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.shipping_profiles_id_seq OWNED BY public.shipping_profiles.id;


--
-- Name: sku_mappings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.sku_mappings (
    id integer NOT NULL,
    user_id character varying NOT NULL,
    ebay_sku text NOT NULL,
    vendor_id integer,
    vendor_sku text DEFAULT ''::text NOT NULL,
    vendor_product_url text,
    vendor_name text,
    cost_price numeric(10,2),
    price_threshold numeric(10,2),
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    ebay_title text,
    ebay_price numeric(10,2)
);


ALTER TABLE public.sku_mappings OWNER TO postgres;

--
-- Name: sku_mappings_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.sku_mappings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.sku_mappings_id_seq OWNER TO postgres;

--
-- Name: sku_mappings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.sku_mappings_id_seq OWNED BY public.sku_mappings.id;


--
-- Name: stores; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.stores (
    id integer NOT NULL,
    user_id character varying NOT NULL,
    name text NOT NULL,
    platform text NOT NULL,
    credentials jsonb NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    last_sync timestamp without time zone,
    created_at timestamp without time zone DEFAULT now(),
    auto_restock boolean DEFAULT false NOT NULL,
    auto_pause_listings boolean DEFAULT false NOT NULL,
    auto_mark_out_of_stock boolean DEFAULT false NOT NULL,
    auto_switch_supplier boolean DEFAULT false NOT NULL,
    restock_threshold integer DEFAULT 1 NOT NULL
);


ALTER TABLE public.stores OWNER TO postgres;

--
-- Name: stores_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.stores_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.stores_id_seq OWNER TO postgres;

--
-- Name: stores_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.stores_id_seq OWNED BY public.stores.id;


--
-- Name: subscriptions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.subscriptions (
    id integer NOT NULL,
    user_id character varying NOT NULL,
    stripe_subscription_id text,
    plan_name text,
    status text DEFAULT 'active'::text NOT NULL,
    current_period_end timestamp without time zone,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.subscriptions OWNER TO postgres;

--
-- Name: subscriptions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.subscriptions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.subscriptions_id_seq OWNER TO postgres;

--
-- Name: subscriptions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.subscriptions_id_seq OWNED BY public.subscriptions.id;


--
-- Name: suggestions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.suggestions (
    id integer NOT NULL,
    user_id character varying NOT NULL,
    user_email text NOT NULL,
    user_name text,
    category text DEFAULT 'feature_request'::text NOT NULL,
    subject text NOT NULL,
    message text NOT NULL,
    status text DEFAULT 'new'::text NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    image_urls text[] DEFAULT '{}'::text[]
);


ALTER TABLE public.suggestions OWNER TO postgres;

--
-- Name: suggestions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.suggestions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.suggestions_id_seq OWNER TO postgres;

--
-- Name: suggestions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.suggestions_id_seq OWNED BY public.suggestions.id;


--
-- Name: supplier_replacement_log; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.supplier_replacement_log (
    id integer NOT NULL,
    product_id integer NOT NULL,
    old_vendor_id integer,
    new_vendor_id integer NOT NULL,
    old_vendor_name text,
    new_vendor_name text NOT NULL,
    product_title text NOT NULL,
    product_sku text,
    reason text DEFAULT 'out_of_stock'::text NOT NULL,
    triggered_by text DEFAULT 'auto'::text NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.supplier_replacement_log OWNER TO postgres;

--
-- Name: supplier_replacement_log_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.supplier_replacement_log_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.supplier_replacement_log_id_seq OWNER TO postgres;

--
-- Name: supplier_replacement_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.supplier_replacement_log_id_seq OWNED BY public.supplier_replacement_log.id;


--
-- Name: transactions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.transactions (
    id integer NOT NULL,
    wallet_id integer NOT NULL,
    type text NOT NULL,
    amount numeric(12,2) NOT NULL,
    description text,
    reference_id text,
    status text DEFAULT 'completed'::text NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    withdraw_method text,
    admin_note text,
    processed_at timestamp without time zone
);


ALTER TABLE public.transactions OWNER TO postgres;

--
-- Name: transactions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.transactions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.transactions_id_seq OWNER TO postgres;

--
-- Name: transactions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.transactions_id_seq OWNED BY public.transactions.id;


--
-- Name: trending_products; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.trending_products (
    id integer NOT NULL,
    platform text NOT NULL,
    title text NOT NULL,
    category text,
    price numeric(10,2),
    currency character varying(3) DEFAULT 'GBP'::character varying,
    sales_volume integer,
    rank integer,
    image_url text,
    product_url text,
    month_year character varying(10),
    created_at timestamp without time zone DEFAULT now(),
    vendor_name text,
    vendor_rating numeric(3,1),
    vendor_reviews integer,
    vendor_reliability text,
    link_verified_at timestamp without time zone
);


ALTER TABLE public.trending_products OWNER TO postgres;

--
-- Name: trending_products_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.trending_products_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.trending_products_id_seq OWNER TO postgres;

--
-- Name: trending_products_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.trending_products_id_seq OWNED BY public.trending_products.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    email character varying,
    first_name character varying,
    last_name character varying,
    profile_image_url character varying,
    stripe_customer_id character varying,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    email_verified timestamp without time zone,
    verification_token character varying,
    verification_token_expiry timestamp without time zone,
    policies_accepted timestamp without time zone,
    onboarding_completed timestamp without time zone,
    payment_skipped timestamp without time zone,
    subscription_plan character varying,
    subscription_status character varying,
    referral_code character varying,
    referred_by character varying,
    api_key character varying,
    password character varying,
    unique_url character varying,
    phone character varying(20),
    profile_change_code character varying,
    profile_change_code_expiry timestamp without time zone,
    profile_change_pending text,
    reset_password_token character varying,
    reset_password_token_expiry timestamp without time zone,
    currency character varying(3) DEFAULT 'GBP'::character varying,
    is_admin character varying(5) DEFAULT 'false'::character varying,
    stripe_connect_account_id character varying,
    billing_interval character varying(10),
    disclaimer_accepted timestamp without time zone,
    auto_restock_enabled boolean DEFAULT false,
    auto_restock_buffer integer DEFAULT 10,
    default_profit_enabled boolean DEFAULT false,
    default_profit_percentage integer DEFAULT 30,
    auto_pause_on_failed_stock boolean DEFAULT true,
    publish_dispute_hold boolean DEFAULT false,
    publish_dispute_hold_at timestamp without time zone,
    publish_dispute_stripe_id character varying,
    role character varying DEFAULT 'user'::character varying NOT NULL,
    auto_restock boolean DEFAULT false NOT NULL
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Name: vendors; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.vendors (
    id integer NOT NULL,
    user_id character varying NOT NULL,
    name text NOT NULL,
    website text,
    integration_type text DEFAULT 'custom'::text NOT NULL,
    config jsonb,
    status text DEFAULT 'active'::text NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    is_global boolean DEFAULT false NOT NULL,
    verification_status text DEFAULT 'pending'::text NOT NULL,
    verified_at timestamp without time zone,
    verified_by character varying,
    contact_person text,
    contact_email text,
    contact_phone text,
    category text,
    tags text,
    country text,
    lead_time text,
    payment_terms text,
    notes text,
    logo text,
    min_order_amount numeric(10,2),
    health_score integer,
    average_shipping_days text,
    cancellation_rate numeric(5,2),
    stock_update_reliability text,
    return_rate numeric(5,2),
    late_delivery_rate numeric(5,2),
    total_orders_fulfilled integer DEFAULT 0,
    last_health_check timestamp without time zone
);


ALTER TABLE public.vendors OWNER TO postgres;

--
-- Name: vendors_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.vendors_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.vendors_id_seq OWNER TO postgres;

--
-- Name: vendors_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.vendors_id_seq OWNED BY public.vendors.id;


--
-- Name: vero_audit_log; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.vero_audit_log (
    id integer NOT NULL,
    user_id character varying NOT NULL,
    product_id integer,
    submitted_brand text NOT NULL,
    matched_vero_brand text,
    match_method text,
    outcome text NOT NULL,
    override_by text,
    override_reason text,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.vero_audit_log OWNER TO postgres;

--
-- Name: vero_audit_log_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.vero_audit_log_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.vero_audit_log_id_seq OWNER TO postgres;

--
-- Name: vero_audit_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.vero_audit_log_id_seq OWNED BY public.vero_audit_log.id;


--
-- Name: vero_brand_aliases; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.vero_brand_aliases (
    id integer NOT NULL,
    canonical_brand text NOT NULL,
    alias text NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.vero_brand_aliases OWNER TO postgres;

--
-- Name: vero_brand_aliases_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.vero_brand_aliases_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.vero_brand_aliases_id_seq OWNER TO postgres;

--
-- Name: vero_brand_aliases_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.vero_brand_aliases_id_seq OWNED BY public.vero_brand_aliases.id;


--
-- Name: vero_list; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.vero_list (
    id integer NOT NULL,
    user_id character varying NOT NULL,
    type text DEFAULT 'brand'::text NOT NULL,
    value text NOT NULL,
    platform text,
    reason text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.vero_list OWNER TO postgres;

--
-- Name: vero_list_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.vero_list_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.vero_list_id_seq OWNER TO postgres;

--
-- Name: vero_list_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.vero_list_id_seq OWNED BY public.vero_list.id;


--
-- Name: wallet; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.wallet (
    id integer NOT NULL,
    user_id character varying NOT NULL,
    balance numeric(12,2) DEFAULT 0.00 NOT NULL,
    currency text DEFAULT 'USD'::text,
    updated_at timestamp without time zone DEFAULT now(),
    referral_balance numeric(12,2) DEFAULT 0.00 NOT NULL,
    points numeric(12,4) DEFAULT 0.0000 NOT NULL,
    bank_account_name character varying,
    bank_account_number character varying,
    bank_sort_code character varying,
    bank_name character varying
);


ALTER TABLE public.wallet OWNER TO postgres;

--
-- Name: wallet_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.wallet_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.wallet_id_seq OWNER TO postgres;

--
-- Name: wallet_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.wallet_id_seq OWNED BY public.wallet.id;


--
-- Name: addon_purchases id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.addon_purchases ALTER COLUMN id SET DEFAULT nextval('public.addon_purchases_id_seq'::regclass);


--
-- Name: admin_settings id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admin_settings ALTER COLUMN id SET DEFAULT nextval('public.admin_settings_id_seq'::regclass);


--
-- Name: app_settings id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.app_settings ALTER COLUMN id SET DEFAULT nextval('public.app_settings_id_seq'::regclass);


--
-- Name: audit_logs id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_logs ALTER COLUMN id SET DEFAULT nextval('public.audit_logs_id_seq'::regclass);


--
-- Name: catalog_refresh_log id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.catalog_refresh_log ALTER COLUMN id SET DEFAULT nextval('public.catalog_refresh_log_id_seq'::regclass);


--
-- Name: content_filters id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.content_filters ALTER COLUMN id SET DEFAULT nextval('public.content_filters_id_seq'::regclass);


--
-- Name: conversations id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conversations ALTER COLUMN id SET DEFAULT nextval('public.conversations_id_seq'::regclass);


--
-- Name: drop_and_sell_orders id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.drop_and_sell_orders ALTER COLUMN id SET DEFAULT nextval('public.drop_and_sell_orders_id_seq'::regclass);


--
-- Name: feature_flags id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.feature_flags ALTER COLUMN id SET DEFAULT nextval('public.feature_flags_id_seq'::regclass);


--
-- Name: freelancer_profiles id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.freelancer_profiles ALTER COLUMN id SET DEFAULT nextval('public.freelancer_profiles_id_seq'::regclass);


--
-- Name: fulfillment_jobs id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fulfillment_jobs ALTER COLUMN id SET DEFAULT nextval('public.fulfillment_jobs_id_seq'::regclass);


--
-- Name: global_vero_list id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.global_vero_list ALTER COLUMN id SET DEFAULT nextval('public.global_vero_list_id_seq'::regclass);


--
-- Name: import_jobs id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.import_jobs ALTER COLUMN id SET DEFAULT nextval('public.import_jobs_id_seq'::regclass);


--
-- Name: marketplace_listings id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketplace_listings ALTER COLUMN id SET DEFAULT nextval('public.marketplace_listings_id_seq'::regclass);


--
-- Name: messages id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.messages ALTER COLUMN id SET DEFAULT nextval('public.messages_id_seq'::regclass);


--
-- Name: notifications id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications ALTER COLUMN id SET DEFAULT nextval('public.notifications_id_seq'::regclass);


--
-- Name: orders id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders ALTER COLUMN id SET DEFAULT nextval('public.orders_id_seq'::regclass);


--
-- Name: payment_cards id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payment_cards ALTER COLUMN id SET DEFAULT nextval('public.payment_cards_id_seq'::regclass);


--
-- Name: paypal_payout_accruals id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.paypal_payout_accruals ALTER COLUMN id SET DEFAULT nextval('public.paypal_payout_accruals_id_seq'::regclass);


--
-- Name: pricing_rules id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pricing_rules ALTER COLUMN id SET DEFAULT nextval('public.pricing_rules_id_seq'::regclass);


--
-- Name: product_variations id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_variations ALTER COLUMN id SET DEFAULT nextval('public.product_variations_id_seq'::regclass);


--
-- Name: products id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products ALTER COLUMN id SET DEFAULT nextval('public.products_id_seq'::regclass);


--
-- Name: publish_queue id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.publish_queue ALTER COLUMN id SET DEFAULT nextval('public.publish_queue_id_seq'::regclass);


--
-- Name: referrals id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.referrals ALTER COLUMN id SET DEFAULT nextval('public.referrals_id_seq'::regclass);


--
-- Name: restock_logs id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.restock_logs ALTER COLUMN id SET DEFAULT nextval('public.restock_logs_id_seq'::regclass);


--
-- Name: restricted_products id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.restricted_products ALTER COLUMN id SET DEFAULT nextval('public.restricted_products_id_seq'::regclass);


--
-- Name: return_requests id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.return_requests ALTER COLUMN id SET DEFAULT nextval('public.return_requests_id_seq'::regclass);


--
-- Name: shipping_profiles id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shipping_profiles ALTER COLUMN id SET DEFAULT nextval('public.shipping_profiles_id_seq'::regclass);


--
-- Name: sku_mappings id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sku_mappings ALTER COLUMN id SET DEFAULT nextval('public.sku_mappings_id_seq'::regclass);


--
-- Name: stores id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stores ALTER COLUMN id SET DEFAULT nextval('public.stores_id_seq'::regclass);


--
-- Name: subscriptions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.subscriptions ALTER COLUMN id SET DEFAULT nextval('public.subscriptions_id_seq'::regclass);


--
-- Name: suggestions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.suggestions ALTER COLUMN id SET DEFAULT nextval('public.suggestions_id_seq'::regclass);


--
-- Name: supplier_replacement_log id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.supplier_replacement_log ALTER COLUMN id SET DEFAULT nextval('public.supplier_replacement_log_id_seq'::regclass);


--
-- Name: transactions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transactions ALTER COLUMN id SET DEFAULT nextval('public.transactions_id_seq'::regclass);


--
-- Name: trending_products id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.trending_products ALTER COLUMN id SET DEFAULT nextval('public.trending_products_id_seq'::regclass);


--
-- Name: vendors id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vendors ALTER COLUMN id SET DEFAULT nextval('public.vendors_id_seq'::regclass);


--
-- Name: vero_audit_log id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vero_audit_log ALTER COLUMN id SET DEFAULT nextval('public.vero_audit_log_id_seq'::regclass);


--
-- Name: vero_brand_aliases id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vero_brand_aliases ALTER COLUMN id SET DEFAULT nextval('public.vero_brand_aliases_id_seq'::regclass);


--
-- Name: vero_list id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vero_list ALTER COLUMN id SET DEFAULT nextval('public.vero_list_id_seq'::regclass);


--
-- Name: wallet id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wallet ALTER COLUMN id SET DEFAULT nextval('public.wallet_id_seq'::regclass);


--
-- Data for Name: addon_catalog; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.addon_catalog (id, name, description, price, created_at, updated_at, image, category, is_new) FROM stdin;
2879e3d4-929d-448e-8a25-c242a5c092e8	Product Photography Kit	Professional lighting and backdrop setup for product photos.	39.99	2026-07-02 11:44:51.434484	2026-07-02 11:44:51.434484	\N	tools	t
704ebc38-0128-40b5-b2e9-91a551bc63fe	AI Description Writer	Generate compelling product descriptions with AI.	19.99	2026-07-02 11:44:51.440232	2026-07-02 11:44:51.440232	\N	tools	t
bd69d411-1f80-4fa1-9460-6fafb6db09f8	Marketplace Analytics	Advanced analytics dashboard for all your marketplaces.	59.99	2026-07-02 11:44:51.512883	2026-07-02 11:44:51.512883	\N	services	t
02c5f0f4-0796-41aa-a1de-a2a5cee1f21c	Bulk Listing Creator	Create hundreds of listings from a single CSV file.	24.99	2026-07-02 11:44:51.516547	2026-07-02 11:44:51.516547	\N	tools	f
ee977a3a-1a2d-4ea4-ac42-dce991932200	Competitor Price Tracker	Track competitor pricing and adjust automatically.	34.99	2026-07-02 11:44:51.522866	2026-07-02 11:44:51.522866	\N	tools	f
e2948e7b-085f-4d2e-a17b-39cd44d08305	Premium Support Pack	Priority support with 24/7 live chat and phone access.	79.99	2026-07-02 11:44:51.525641	2026-07-02 11:44:51.525641	\N	services	f
3e154105-e938-4b9a-b3a3-f467ec23bc58	Social Media Kit	Templates and scheduling for social media promotion.	14.99	2026-07-02 11:44:51.531796	2026-07-02 11:44:51.531796	\N	content	f
8bd6aafa-1544-4eed-af30-a67cd6cb45e8	Inventory Forecasting	AI-powered demand forecasting to optimize stock levels.	44.99	2026-07-02 11:44:51.53548	2026-07-02 11:44:51.53548	\N	tools	f
\.


--
-- Data for Name: addon_purchases; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.addon_purchases (id, user_id, addon_id, status, stripe_payment_id, purchased_at) FROM stdin;
\.


--
-- Data for Name: admin_settings; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.admin_settings (id, site_name, maintenance_mode, allow_new_registrations, default_subscription_plan, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: app_settings; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.app_settings (id, key, value, updated_at) FROM stdin;
\.


--
-- Data for Name: app_state; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.app_state (key, value, updated_at) FROM stdin;
subscriber_update_email_last_sent_at	2026-06-26T13:00:39.367Z	2026-06-26 13:00:39.367613
subscriber_update_email_next_slot	2026-06-30T09:00:00.000Z	2026-06-28 17:50:06.703361
\.


--
-- Data for Name: audit_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.audit_logs (id, user_id, order_id, action, source, vendor_used, payment_method, fulfillment_status, details, created_at) FROM stdin;
1	test-user-001	\N	no_plan_reminder_sent_v1	system	\N	\N	\N	{"email": "test@test.com"}	2026-04-20 12:56:38.978097
2	test-storerules-1777215393655	\N	no_plan_reminder_sent_v1	system	\N	\N	\N	{"email": "storerules+1777215393655@example.com"}	2026-04-26 14:57:34.897002
3	test-srules-1777215936261	\N	no_plan_reminder_sent_v1	system	\N	\N	\N	{"email": "srules+1777215936261@example.com"}	2026-04-26 15:08:46.590272
4	test-toggleoff-1777216241036	\N	no_plan_reminder_sent_v1	system	\N	\N	\N	{"email": "toggleoff+1777216241036@example.com"}	2026-04-26 15:12:19.44647
5	test-extlink-1777216909226	\N	no_plan_reminder_sent_v1	system	\N	\N	\N	{"email": "extlink+1777216909226@example.com"}	2026-04-26 15:23:38.04453
6	test-extcreds-1777217044521	\N	no_plan_reminder_sent_v1	system	\N	\N	\N	{"email": "extcreds+1777217044521@example.com"}	2026-04-26 15:26:10.532293
7	test-extok-1777217220294	\N	no_plan_reminder_sent_v1	system	\N	\N	\N	{"email": "extok+1777217220294@example.com"}	2026-04-26 15:28:28.889618
8	test-extsec-1777217529961	\N	no_plan_reminder_sent_v1	system	\N	\N	\N	{"email": "extsec+1777217529961@example.com"}	2026-04-26 15:33:48.889494
9	test-finalsec-1777217837615	\N	no_plan_reminder_sent_v1	system	\N	\N	\N	{"email": "finalsec+1777217837615@example.com"}	2026-04-26 15:38:52.16474
10	test-final-1777218061987	\N	no_plan_reminder_sent_v1	system	\N	\N	\N	{"email": "final+1777218061987@example.com"}	2026-04-26 15:42:25.804202
11	test-das-delete-1777906021093	\N	no_plan_reminder_sent_v1	system	\N	\N	\N	{"email": "rtrebecca@yahoo.com"}	2026-05-04 14:49:10.807956
12	test-lister-uid-f84212f	\N	no_plan_reminder_sent_v1	system	\N	\N	\N	{"email": "sarah.j@dropandsell.online"}	2026-05-04 15:08:17.195035
13	test-user-001	\N	no_plan_reminder_sent_v2	system	\N	\N	\N	{"email": "test@test.com"}	2026-05-05 21:17:14.064777
14	test-storerules-1777215393655	\N	no_plan_reminder_sent_v2	system	\N	\N	\N	{"email": "storerules+1777215393655@example.com"}	2026-05-05 21:17:17.455261
15	test-finalsec-1777217837615	\N	no_plan_reminder_sent_v2	system	\N	\N	\N	{"email": "finalsec+1777217837615@example.com"}	2026-05-05 21:17:18.028307
16	test-srules-1777215936261	\N	no_plan_reminder_sent_v2	system	\N	\N	\N	{"email": "srules+1777215936261@example.com"}	2026-05-05 21:17:18.501906
17	test-toggleoff-1777216241036	\N	no_plan_reminder_sent_v2	system	\N	\N	\N	{"email": "toggleoff+1777216241036@example.com"}	2026-05-05 21:17:18.877957
18	test-final-1777218061987	\N	no_plan_reminder_sent_v2	system	\N	\N	\N	{"email": "final+1777218061987@example.com"}	2026-05-05 21:17:19.263829
19	test-extlink-1777216909226	\N	no_plan_reminder_sent_v2	system	\N	\N	\N	{"email": "extlink+1777216909226@example.com"}	2026-05-05 21:17:19.625623
20	test-extcreds-1777217044521	\N	no_plan_reminder_sent_v2	system	\N	\N	\N	{"email": "extcreds+1777217044521@example.com"}	2026-05-05 21:17:20.032259
21	test-extok-1777217220294	\N	no_plan_reminder_sent_v2	system	\N	\N	\N	{"email": "extok+1777217220294@example.com"}	2026-05-05 21:17:20.418544
22	test-extsec-1777217529961	\N	no_plan_reminder_sent_v2	system	\N	\N	\N	{"email": "extsec+1777217529961@example.com"}	2026-05-05 21:17:20.796339
23	test-das-delete-1777906021093	\N	no_plan_reminder_sent_v2	system	\N	\N	\N	{"email": "rtrebecca@yahoo.com"}	2026-05-05 21:17:21.189762
24	test-lister-uid-f84212f	\N	no_plan_reminder_sent_v2	system	\N	\N	\N	{"email": "sarah.j@dropandsell.online"}	2026-05-05 21:17:21.620745
\.


--
-- Data for Name: broadcast_campaign_log; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.broadcast_campaign_log (broadcast_date, created_at) FROM stdin;
\.


--
-- Data for Name: catalog_refresh_log; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.catalog_refresh_log (id, items_added, items_updated, last_refreshed_at) FROM stdin;
1	8	0	2026-07-02 11:44:51.543512
\.


--
-- Data for Name: content_filters; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.content_filters (id, user_id, type, pattern, description, is_active, created_at) FROM stdin;
\.


--
-- Data for Name: conversations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.conversations (id, title, created_at, user_id) FROM stdin;
\.


--
-- Data for Name: drop_and_sell_orders; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.drop_and_sell_orders (id, user_id, listing_count, total_price, status, freelancer_id, assigned_at, completed_at, payment_status, stripe_session_id, notes, delivery_summary, user_feedback, user_rating, created_at, updated_at, store_id, lister_earnings, platform_fee, deadline, progress_count, payout_status, categories, default_quantity, price_preference, preferred_vendors, profit_margin_percent) FROM stdin;
3	test-user-001	5	40.00	in_progress	1	2026-05-04 15:05:08.55127	\N	paid	\N	\N	\N	\N	\N	2026-05-04 15:05:08.55127	2026-05-04 15:05:08.55127	\N	30.00	10.00	2026-05-11 15:05:08.55127	0	pending	{}	1	\N	{}	\N
4	test-user-001	5	40.00	pending	\N	\N	\N	pending	\N	\N	\N	\N	\N	2026-05-04 15:05:08.555175	2026-05-04 15:05:08.555175	\N	30.00	10.00	\N	0	pending	{}	1	\N	{}	\N
\.


--
-- Data for Name: feature_flags; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.feature_flags (id, feature_key, name, description, is_enabled, admin_only, created_at, updated_at, metadata) FROM stdin;
1	auto_fulfillment	Automated Fulfillment System	End-to-end automated dropshipping fulfillment from eBay to vendor platforms	t	f	2026-03-27 00:58:34.213144	2026-03-27 00:58:34.213144	\N
3	jumia_marketplace	Jumia Marketplace	Jumia marketplace integration — connect stores, sync orders, and publish products across 12 African countries.	t	t	2026-04-01 00:53:30.467291	2026-04-01 00:53:30.467291	\N
4	drop_and_sell	Drop-and-Sell Listing Service	Freelance listers curate and publish winning products on behalf of users. £30 per 150 listings.	t	t	2026-04-06 09:04:08.052758	2026-04-06 09:04:08.052758	\N
\.


--
-- Data for Name: freelancer_profiles; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.freelancer_profiles (id, name, email, specialties, rating, completed_jobs, is_available, created_at, user_id, wallet_balance, total_earnings, stripe_connect_id, active_job_count, years_experience, has_community, community_name, referrals_made, application_status) FROM stdin;
1	Sarah Johnson	sarah.j@dropandsell.online	{Electronics,Fashion,"Home & Garden"}	4.90	47	t	2026-04-06 09:04:08.052758	\N	0.00	0.00	\N	0	\N	f	\N	0	approved
2	James Okafor	james.o@dropandsell.online	{Sports,Automotive,Tools}	4.85	32	t	2026-04-06 09:04:08.052758	\N	0.00	0.00	\N	0	\N	f	\N	0	approved
3	Emily Chen	emily.c@dropandsell.online	{"Health & Beauty",Fashion,Baby}	4.95	61	t	2026-04-06 09:04:08.052758	\N	0.00	0.00	\N	0	\N	f	\N	0	approved
4	David Williams	david.w@dropandsell.online	{Electronics,Gaming,Entertainment}	4.80	28	t	2026-04-06 09:04:08.052758	\N	0.00	0.00	\N	0	\N	f	\N	0	approved
5	Amara Osei	amara.o@dropandsell.online	{"Home & Garden",Kitchen,General}	4.88	39	t	2026-04-06 09:04:08.052758	\N	0.00	0.00	\N	0	\N	f	\N	0	approved
\.


--
-- Data for Name: fulfillment_jobs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.fulfillment_jobs (id, user_id, order_id, sku_mapping_id, vendor_id, vendor_name, vendor_order_id, status, tracking_number, carrier, payment_method, payment_status, amount_charged, error_message, retry_count, sourcing_type, created_at, fulfilled_at, updated_at) FROM stdin;
\.


--
-- Data for Name: global_vero_list; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.global_vero_list (id, type, value, platform, reason, category, severity, is_active, created_at) FROM stdin;
42	brand	Beats by Dre	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 10:24:10.147418
397	brand	Arduino	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 16:38:04.569532
398	brand	Intuit	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 16:38:04.571635
55	brand	Under Armour	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 10:24:10.18051
258	brand	Abercrombie & Fitch	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 11:39:22.870633
399	brand	Lucasfilm	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 16:38:04.594646
400	brand	Star Wars	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 16:38:04.596859
401	brand	LEGO	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 16:38:04.601299
402	brand	Funko	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 16:38:04.609017
403	brand	Good Smile Company	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 16:38:04.610886
79	brand	Porsche	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 10:24:10.242052
404	brand	General Motors	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 16:38:04.624277
405	brand	Jaguar	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 16:38:04.626188
406	brand	Land Rover	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 16:38:04.628329
407	brand	Delorean	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 16:38:04.630402
408	brand	Bombardier	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 16:38:04.633395
61	brand	MAC Cosmetics	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 10:24:10.195845
409	brand	Dermalogica	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 16:38:04.645176
410	brand	Dollar Shave Club	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 16:38:04.648999
411	brand	Amway	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 16:38:04.652073
412	brand	It Works	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 16:38:04.654123
413	brand	Forever Living	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 16:38:04.658023
414	brand	Alessi	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 16:38:04.661079
415	brand	All Saints	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 16:38:04.665101
416	brand	American Eagle Outfitters	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 16:38:04.667783
417	brand	Axon	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 16:38:04.670244
418	brand	Taser	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 16:38:04.673715
419	brand	Benchmade	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 16:38:04.676143
420	brand	Bloomberg	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 16:38:04.678596
421	brand	Brother International	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 16:38:04.68116
108	brand	Caterpillar	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 10:24:10.311824
203	brand	Hugo Boss	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 11:39:03.239706
437	brand	Juul	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 16:38:04.727274
362	brand	Monster Energy	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 11:39:58.733093
193	brand	Philips Norelco	\N	Grooming - VeRO participant	brand_protection	warn	t	2026-04-04 11:38:43.555727
227	brand	Asus	\N	Technology - VeRO participant	brand_protection	warn	t	2026-04-04 11:39:03.239706
239	brand	Audio-Technica	\N	Audio - VeRO participant	brand_protection	warn	t	2026-04-04 11:39:03.239706
268	brand	Jack Wolfskin	\N	Outdoor fashion - VeRO participant	brand_protection	warn	t	2026-04-04 11:39:22.870633
333	brand	DeLonghi	\N	Kitchen - VeRO participant	brand_protection	warn	t	2026-04-04 11:39:58.733093
422	brand	Buck Knives	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 16:38:04.684575
423	brand	Car-Freshner	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 16:38:04.688751
424	brand	Chandler Tool	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 16:38:04.690573
425	brand	Chloé	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 16:38:04.693934
426	brand	Coway	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 16:38:04.696498
427	brand	Dansko	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 16:38:04.699044
428	brand	Gerber Childrenswear	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 16:38:04.704456
429	brand	Gibson	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 16:38:04.706901
430	brand	Gretsch	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 16:38:04.708748
431	brand	GUNNAR Optiks	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 16:38:04.710512
432	brand	iFixit	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 16:38:04.712995
433	brand	Incipio	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 16:38:04.714972
434	brand	Jabra	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 16:38:04.716993
435	brand	GN Netcom	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 16:38:04.719353
436	brand	Jemella	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 16:38:04.721727
438	brand	Kirby	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 16:38:04.729679
439	brand	Moon Boot	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 16:38:04.731514
440	brand	Technica	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 16:38:04.733259
441	brand	TechSmith	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 16:38:04.735082
442	brand	Telebrands	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 16:38:04.73747
443	brand	The Richemont Group	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 16:38:04.739329
444	brand	Tiffany & Co	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 16:38:04.741205
445	brand	Tommie Copper	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 16:38:04.746134
446	brand	Nordstrom	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 16:38:04.748133
447	brand	Levi Strauss	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 16:38:04.751854
29	brand	Michael Kors	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 10:24:10.115042
35	brand	Oakley	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 10:24:10.130523
33	brand	Swarovski	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 10:24:10.125453
115	brand	Dr. Martens	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 10:24:10.32853
51	brand	Fitbit	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 10:24:10.171223
82	brand	Volkswagen	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 10:24:10.250131
448	brand	Rolex Watches	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 16:38:04.850607
449	brand	Omega Watches	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 16:38:04.852398
96	brand	FIFA	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 10:24:10.283859
117	brand	Vans	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 10:24:10.332852
210	brand	Issey Miyake	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 11:39:03.239706
310	brand	TaylorMade	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 11:39:58.733093
69	brand	NARS	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 10:24:10.216795
72	brand	La Mer	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 10:24:10.224966
187	brand	Sunday Riley	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 11:38:43.555727
450	brand	Velcro	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 16:38:04.995053
451	brand	Onesie	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 16:38:04.997982
452	brand	GoPro Hero	\N	Brand advisory — listing allowed with caution	brand_protection	warn	t	2026-04-04 16:38:04.999943
453	brand	Garmin Watch	\N	Brand advisory — listing allowed with caution	brand_protection	warn	t	2026-04-04 16:38:05.00242
136	keyword	replica	\N	Counterfeit indicator — listing allowed	counterfeit_prevention	warn	t	2026-04-04 10:24:10.373302
137	keyword	knockoff	\N	Counterfeit indicator — listing allowed	counterfeit_prevention	warn	t	2026-04-04 10:24:10.375234
138	keyword	knock off	\N	Counterfeit indicator — listing allowed	counterfeit_prevention	warn	t	2026-04-04 10:24:10.376995
139	keyword	fake	\N	Counterfeit indicator — listing allowed	counterfeit_prevention	warn	t	2026-04-04 10:24:10.379379
140	keyword	counterfeit	\N	Counterfeit indicator — listing allowed	counterfeit_prevention	warn	t	2026-04-04 10:24:10.381368
141	keyword	imitation	\N	Counterfeit indicator — listing allowed	counterfeit_prevention	warn	t	2026-04-04 10:24:10.383282
147	keyword	1:1 copy	\N	Counterfeit indicator — listing allowed	counterfeit_prevention	warn	t	2026-04-04 10:24:10.395767
148	keyword	mirror copy	\N	Counterfeit indicator — listing allowed	counterfeit_prevention	warn	t	2026-04-04 10:24:10.397928
149	keyword	not original	\N	Counterfeit indicator — listing allowed	counterfeit_prevention	warn	t	2026-04-04 10:24:10.399878
150	keyword	unauthorized	\N	Counterfeit indicator — listing allowed	counterfeit_prevention	warn	t	2026-04-04 10:24:10.401988
142	keyword	inspired by	\N	Counterfeit indicator	counterfeit_prevention	warn	t	2026-04-04 10:24:10.385076
143	keyword	style of	\N	Counterfeit indicator	counterfeit_prevention	warn	t	2026-04-04 10:24:10.387457
144	keyword	like authentic	\N	Counterfeit indicator	counterfeit_prevention	warn	t	2026-04-04 10:24:10.389524
145	keyword	designer inspired	\N	Counterfeit indicator	counterfeit_prevention	warn	t	2026-04-04 10:24:10.391426
146	keyword	AAA quality	\N	Counterfeit grade indicator	counterfeit_prevention	warn	t	2026-04-04 10:24:10.393423
235	brand	Sonos	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 11:39:03.239706
391	keyword	bootleg	\N	Counterfeit indicator — listing allowed	counterfeit_prevention	warn	t	2026-04-04 11:39:58.733093
392	keyword	pirated	\N	Counterfeit indicator — listing allowed	counterfeit_prevention	warn	t	2026-04-04 11:39:58.733093
395	keyword	super copy	\N	Counterfeit indicator — listing allowed	counterfeit_prevention	warn	t	2026-04-04 11:39:58.733093
389	keyword	dupes	\N	Counterfeit indicator	counterfeit_prevention	warn	t	2026-04-04 11:39:58.733093
390	keyword	dupe	\N	Counterfeit indicator	counterfeit_prevention	warn	t	2026-04-04 11:39:58.733093
393	keyword	OEM copy	\N	Counterfeit indicator	counterfeit_prevention	warn	t	2026-04-04 11:39:58.733093
394	keyword	grade A copy	\N	Counterfeit indicator	counterfeit_prevention	warn	t	2026-04-04 11:39:58.733093
396	keyword	unbranded alternative	\N	Counterfeit indicator	counterfeit_prevention	warn	t	2026-04-04 11:39:58.733093
1	brand	Louis Vuitton	\N	Luxury goods - aggressive IP enforcement	brand_protection	block	t	2026-04-04 10:24:10.024778
2	brand	Gucci	\N	Luxury goods - VeRO participant	brand_protection	block	t	2026-04-04 10:24:10.02841
3	brand	Chanel	\N	Luxury goods - VeRO participant	brand_protection	block	t	2026-04-04 10:24:10.03991
4	brand	Prada	\N	Luxury goods - VeRO participant	brand_protection	block	t	2026-04-04 10:24:10.042779
5	brand	Hermès	\N	Luxury goods - VeRO participant	brand_protection	block	t	2026-04-04 10:24:10.04569
6	brand	Hermes	\N	Luxury goods - VeRO participant	brand_protection	block	t	2026-04-04 10:24:10.048595
7	brand	Burberry	\N	Luxury goods - VeRO participant	brand_protection	block	t	2026-04-04 10:24:10.051734
8	brand	Dior	\N	Luxury goods - VeRO participant	brand_protection	block	t	2026-04-04 10:24:10.054414
28	brand	Armani	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 10:24:10.112257
36	brand	Apple	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 10:24:10.133787
41	brand	Bose	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 10:24:10.144828
10	brand	Balenciaga	\N	Luxury goods - VeRO participant	brand_protection	block	t	2026-04-04 10:24:10.060376
11	brand	Givenchy	\N	Luxury goods - VeRO participant	brand_protection	block	t	2026-04-04 10:24:10.06411
12	brand	Fendi	\N	Luxury goods - VeRO participant	brand_protection	block	t	2026-04-04 10:24:10.066676
13	brand	Valentino	\N	Luxury goods - VeRO participant	brand_protection	block	t	2026-04-04 10:24:10.069562
14	brand	Saint Laurent	\N	Luxury goods - VeRO participant	brand_protection	block	t	2026-04-04 10:24:10.072335
15	brand	Bottega Veneta	\N	Luxury goods - VeRO participant	brand_protection	block	t	2026-04-04 10:24:10.075578
16	brand	Cartier	\N	Luxury goods - VeRO participant	brand_protection	block	t	2026-04-04 10:24:10.078839
17	brand	Tiffany	\N	Jewelry - VeRO participant	brand_protection	block	t	2026-04-04 10:24:10.081791
18	brand	Rolex	\N	Watches - aggressive VeRO enforcement	brand_protection	block	t	2026-04-04 10:24:10.085621
19	brand	Omega	\N	Watches - VeRO participant	brand_protection	block	t	2026-04-04 10:24:10.088613
20	brand	TAG Heuer	\N	Watches - VeRO participant	brand_protection	block	t	2026-04-04 10:24:10.091201
21	brand	Patek Philippe	\N	Watches - VeRO participant	brand_protection	block	t	2026-04-04 10:24:10.094422
22	brand	Breitling	\N	Watches - VeRO participant	brand_protection	block	t	2026-04-04 10:24:10.097326
26	brand	Lacoste	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 10:24:10.107534
25	brand	Calvin Klein	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 10:24:10.105571
30	brand	Kate Spade	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 10:24:10.117772
60	brand	Patagonia	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 10:24:10.193799
58	brand	The North Face	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 10:24:10.188714
62	brand	Estée Lauder	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 10:24:10.199024
34	brand	Ray-Ban	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 10:24:10.128012
38	brand	Sony	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 10:24:10.137859
45	brand	Philips	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 10:24:10.155223
39	brand	Microsoft	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 10:24:10.140356
40	brand	Nintendo	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 10:24:10.142914
44	brand	Dyson	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 10:24:10.152479
43	brand	GoPro	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 10:24:10.149938
49	brand	DJI	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 10:24:10.165705
52	brand	Nike	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 10:24:10.174547
53	brand	Adidas	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 10:24:10.176472
46	brand	Canon	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 10:24:10.157856
50	brand	Garmin	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 10:24:10.168771
48	brand	JBL	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 10:24:10.163231
27	brand	Hugo Boss	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 10:24:10.109454
68	brand	Charlotte Tilbury	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 10:24:10.214136
24	brand	Tommy Hilfiger	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 10:24:10.102357
74	brand	Tom Ford	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 10:24:10.230423
47	brand	Nikon	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 10:24:10.160618
23	brand	Ralph Lauren	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 10:24:10.099819
54	brand	Puma	\N	Sportswear - VeRO participant	brand_protection	warn	t	2026-04-04 10:24:10.17845
31	brand	Coach	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 10:24:10.120318
56	brand	New Balance	\N	Sportswear - VeRO participant	brand_protection	warn	t	2026-04-04 10:24:10.183734
57	brand	Reebok	\N	Sportswear - VeRO participant	brand_protection	warn	t	2026-04-04 10:24:10.186678
59	brand	Columbia	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 10:24:10.191336
37	brand	Samsung	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 10:24:10.135911
73	brand	Jo Malone	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 10:24:10.22841
63	brand	Estee Lauder	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 10:24:10.202172
64	brand	Clinique	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 10:24:10.204819
65	brand	Lancôme	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 10:24:10.20731
66	brand	Lancome	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 10:24:10.209235
32	brand	Pandora	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 10:24:10.123132
75	brand	Creed	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 10:24:10.232332
71	brand	Kiehl's	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 10:24:10.222049
67	brand	Urban Decay	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 10:24:10.212254
77	brand	BMW	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 10:24:10.23743
76	brand	Yankee Candle	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 10:24:10.234242
70	brand	Benefit Cosmetics	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 10:24:10.219055
135	brand	Dolce & Gabbana	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 10:24:10.371362
119	brand	Lululemon	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 10:24:10.337877
84	brand	Ford	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 10:24:10.254972
126	brand	Fred Perry	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 10:24:10.352061
131	brand	Jimmy Choo	\N	Luxury goods - VeRO participant	brand_protection	block	t	2026-04-04 10:24:10.362908
132	brand	Christian Louboutin	\N	Luxury goods - VeRO participant	brand_protection	block	t	2026-04-04 10:24:10.364856
133	brand	Montblanc	\N	Luxury goods - VeRO participant	brand_protection	block	t	2026-04-04 10:24:10.36672
134	brand	Bvlgari	\N	Luxury goods - VeRO participant	brand_protection	block	t	2026-04-04 10:24:10.368487
120	brand	Supreme	\N	Streetwear - VeRO participant	brand_protection	block	t	2026-04-04 10:24:10.340135
122	brand	Stone Island	\N	Fashion - VeRO participant	brand_protection	block	t	2026-04-04 10:24:10.343984
123	brand	Moncler	\N	Fashion - VeRO participant	brand_protection	block	t	2026-04-04 10:24:10.346454
109	brand	John Deere	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 10:24:10.315184
89	brand	Weber	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 10:24:10.267493
86	brand	KitchenAid	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 10:24:10.259836
88	brand	Cuisinart	\N	Kitchen - VeRO participant	brand_protection	warn	t	2026-04-04 10:24:10.264512
90	brand	Yeti	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 10:24:10.27037
91	brand	Stanley	\N	Drinkware - VeRO participant	brand_protection	warn	t	2026-04-04 10:24:10.272266
94	brand	Marvel	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 10:24:10.27966
95	brand	DC Comics	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 10:24:10.281919
93	brand	Warner Bros	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 10:24:10.277444
103	brand	Hasbro	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 10:24:10.30077
97	brand	NFL	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 10:24:10.286924
98	brand	NBA	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 10:24:10.288939
99	brand	Premier League	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 10:24:10.291536
100	brand	UEFA	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 10:24:10.293522
104	brand	Bosch	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 10:24:10.302762
101	brand	Lego	\N	Toys - VeRO participant	brand_protection	warn	t	2026-04-04 10:24:10.296068
80	brand	Ferrari	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 10:24:10.244014
102	brand	Mattel	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 10:24:10.29821
105	brand	DeWalt	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 10:24:10.305329
106	brand	Makita	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 10:24:10.307583
107	brand	3M	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 10:24:10.309631
110	brand	Snap-on	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 10:24:10.317385
129	brand	Vivienne Westwood	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 10:24:10.35857
111	brand	OtterBox	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 10:24:10.3195
87	brand	Le Creuset	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 10:24:10.26202
113	brand	UGG	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 10:24:10.32471
114	brand	Birkenstock	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 10:24:10.326642
116	brand	Converse	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 10:24:10.330451
78	brand	Mercedes-Benz	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 10:24:10.239469
81	brand	Audi	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 10:24:10.24751
92	brand	Disney	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 10:24:10.274454
112	brand	Crocs	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 10:24:10.321668
125	brand	Barbour	\N	Fashion - VeRO participant	brand_protection	warn	t	2026-04-04 10:24:10.350283
127	brand	Paul Smith	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 10:24:10.354408
128	brand	Ted Baker	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 10:24:10.356336
118	brand	Superdry	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 10:24:10.334885
124	brand	Canada Goose	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 10:24:10.348384
85	brand	Harley-Davidson	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 10:24:10.25739
151	brand	Just for Men	\N	Health & grooming - VeRO participant	brand_protection	warn	t	2026-04-04 11:38:43.555727
152	brand	Just For Men	\N	Health & grooming - VeRO participant	brand_protection	warn	t	2026-04-04 11:38:43.555727
153	brand	Gillette	\N	Grooming - VeRO participant	brand_protection	warn	t	2026-04-04 11:38:43.555727
154	brand	Braun	\N	Grooming/Electronics - VeRO participant	brand_protection	warn	t	2026-04-04 11:38:43.555727
155	brand	Olay	\N	Beauty - VeRO participant	brand_protection	warn	t	2026-04-04 11:38:43.555727
156	brand	Pantene	\N	Hair care - VeRO participant	brand_protection	warn	t	2026-04-04 11:38:43.555727
157	brand	Head & Shoulders	\N	Hair care - VeRO participant	brand_protection	warn	t	2026-04-04 11:38:43.555727
158	brand	Oral-B	\N	Dental care - VeRO participant	brand_protection	warn	t	2026-04-04 11:38:43.555727
159	brand	Crest	\N	Dental care - VeRO participant	brand_protection	warn	t	2026-04-04 11:38:43.555727
160	brand	Dove	\N	Personal care - VeRO participant	brand_protection	warn	t	2026-04-04 11:38:43.555727
83	brand	Toyota	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 10:24:10.252377
213	brand	Dolce Gabbana	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 11:39:03.239706
165	brand	Nivea	\N	Skincare - VeRO participant	brand_protection	warn	t	2026-04-04 11:38:43.555727
189	brand	GHD	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 11:38:43.555727
190	brand	ghd	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 11:38:43.555727
166	brand	Vaseline	\N	Skincare - VeRO participant	brand_protection	warn	t	2026-04-04 11:38:43.555727
167	brand	CeraVe	\N	Skincare - VeRO participant	brand_protection	warn	t	2026-04-04 11:38:43.555727
168	brand	The Ordinary	\N	Skincare - VeRO participant	brand_protection	warn	t	2026-04-04 11:38:43.555727
169	brand	La Roche-Posay	\N	Skincare - VeRO participant	brand_protection	warn	t	2026-04-04 11:38:43.555727
170	brand	Vichy	\N	Skincare - VeRO participant	brand_protection	warn	t	2026-04-04 11:38:43.555727
171	brand	Bioderma	\N	Skincare - VeRO participant	brand_protection	warn	t	2026-04-04 11:38:43.555727
172	brand	Garnier	\N	Beauty - VeRO participant	brand_protection	warn	t	2026-04-04 11:38:43.555727
173	brand	Maybelline	\N	Cosmetics - VeRO participant	brand_protection	warn	t	2026-04-04 11:38:43.555727
174	brand	Revlon	\N	Cosmetics - VeRO participant	brand_protection	warn	t	2026-04-04 11:38:43.555727
175	brand	NYX	\N	Cosmetics - VeRO participant	brand_protection	warn	t	2026-04-04 11:38:43.555727
176	brand	Rimmel	\N	Cosmetics - VeRO participant	brand_protection	warn	t	2026-04-04 11:38:43.555727
177	brand	Max Factor	\N	Cosmetics - VeRO participant	brand_protection	warn	t	2026-04-04 11:38:43.555727
183	brand	Clarins	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 11:38:43.555727
178	brand	Bobbi Brown	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 11:38:43.555727
180	brand	Morphe	\N	Cosmetics - VeRO participant	brand_protection	warn	t	2026-04-04 11:38:43.555727
181	brand	Bare Minerals	\N	Cosmetics - VeRO participant	brand_protection	warn	t	2026-04-04 11:38:43.555727
182	brand	bareMinerals	\N	Cosmetics - VeRO participant	brand_protection	warn	t	2026-04-04 11:38:43.555727
184	brand	Shiseido	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 11:38:43.555727
185	brand	SK-II	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 11:38:43.555727
186	brand	Drunk Elephant	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 11:38:43.555727
188	brand	Tatcha	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 11:38:43.555727
207	brand	Giorgio Armani	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 11:39:03.239706
205	brand	Yves Saint Laurent	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 11:39:03.239706
191	brand	BaByliss	\N	Hair tools - VeRO participant	brand_protection	warn	t	2026-04-04 11:38:43.555727
192	brand	Wahl	\N	Grooming - VeRO participant	brand_protection	warn	t	2026-04-04 11:38:43.555727
194	brand	Schwarzkopf	\N	Hair care - VeRO participant	brand_protection	warn	t	2026-04-04 11:38:43.555727
195	brand	Redken	\N	Hair care - VeRO participant	brand_protection	warn	t	2026-04-04 11:38:43.555727
196	brand	Kérastase	\N	Hair care - VeRO participant	brand_protection	warn	t	2026-04-04 11:38:43.555727
197	brand	Kerastase	\N	Hair care - VeRO participant	brand_protection	warn	t	2026-04-04 11:38:43.555727
198	brand	Aussie	\N	Hair care - VeRO participant	brand_protection	warn	t	2026-04-04 11:38:43.555727
199	brand	Herbal Essences	\N	Hair care - VeRO participant	brand_protection	warn	t	2026-04-04 11:38:43.555727
200	brand	Colgate	\N	Dental care - VeRO participant	brand_protection	warn	t	2026-04-04 11:38:43.555727
201	brand	Sensodyne	\N	Dental care - VeRO participant	brand_protection	warn	t	2026-04-04 11:38:43.555727
209	brand	Marc Jacobs	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 11:39:03.239706
206	brand	YSL	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 11:39:03.239706
204	brand	Jean Paul Gaultier	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 11:39:03.239706
208	brand	Paco Rabanne	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 11:39:03.239706
214	brand	Thierry Mugler	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 11:39:03.239706
179	brand	Fenty Beauty	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 11:38:43.555727
211	brand	Davidoff	\N	Fragrance - VeRO participant	brand_protection	warn	t	2026-04-04 11:39:03.239706
212	brand	Calvin Klein CK	\N	Fragrance - VeRO participant	brand_protection	warn	t	2026-04-04 11:39:03.239706
215	brand	Acqua di Gio	\N	Fragrance - VeRO participant	brand_protection	warn	t	2026-04-04 11:39:03.239706
216	brand	Sauvage	\N	Fragrance - VeRO participant	brand_protection	warn	t	2026-04-04 11:39:03.239706
217	brand	Penhaligons	\N	Fragrance - VeRO participant	brand_protection	warn	t	2026-04-04 11:39:03.239706
218	brand	Byredo	\N	Fragrance - VeRO participant	brand_protection	warn	t	2026-04-04 11:39:03.239706
219	brand	Diptyque	\N	Fragrance - VeRO participant	brand_protection	warn	t	2026-04-04 11:39:03.239706
220	brand	Intel	\N	Technology - VeRO participant	brand_protection	warn	t	2026-04-04 11:39:03.239706
221	brand	AMD	\N	Technology - VeRO participant	brand_protection	warn	t	2026-04-04 11:39:03.239706
222	brand	NVIDIA	\N	Technology - VeRO participant	brand_protection	warn	t	2026-04-04 11:39:03.239706
223	brand	Google	\N	Technology - VeRO participant	brand_protection	warn	t	2026-04-04 11:39:03.239706
224	brand	Dell	\N	Technology - VeRO participant	brand_protection	warn	t	2026-04-04 11:39:03.239706
225	brand	HP	\N	Technology - VeRO participant	brand_protection	warn	t	2026-04-04 11:39:03.239706
226	brand	Lenovo	\N	Technology - VeRO participant	brand_protection	warn	t	2026-04-04 11:39:03.239706
228	brand	Acer	\N	Technology - VeRO participant	brand_protection	warn	t	2026-04-04 11:39:03.239706
161	brand	TRESemmé	\N	Hair care - VeRO participant	brand_protection	warn	t	2026-04-04 11:38:43.555727
162	brand	TRESemme	\N	Hair care - VeRO participant	brand_protection	warn	t	2026-04-04 11:38:43.555727
163	brand	Neutrogena	\N	Skincare - VeRO participant	brand_protection	warn	t	2026-04-04 11:38:43.555727
164	brand	Aveeno	\N	Skincare - VeRO participant	brand_protection	warn	t	2026-04-04 11:38:43.555727
286	brand	Mulberry	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 11:39:22.870633
287	brand	MCM	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 11:39:22.870633
229	brand	LG	\N	Technology - VeRO participant	brand_protection	warn	t	2026-04-04 11:39:03.239706
281	brand	Ferragamo	\N	Luxury goods - VeRO participant	brand_protection	block	t	2026-04-04 11:39:22.870633
282	brand	Celine	\N	Luxury goods - VeRO participant	brand_protection	block	t	2026-04-04 11:39:22.870633
283	brand	Loewe	\N	Luxury goods - VeRO participant	brand_protection	block	t	2026-04-04 11:39:22.870633
284	brand	Loro Piana	\N	Luxury goods - VeRO participant	brand_protection	block	t	2026-04-04 11:39:22.870633
285	brand	Brunello Cucinelli	\N	Luxury goods - VeRO participant	brand_protection	block	t	2026-04-04 11:39:22.870633
292	brand	Rimowa	\N	Luggage - VeRO participant	brand_protection	block	t	2026-04-04 11:39:22.870633
230	brand	Panasonic	\N	Technology - VeRO participant	brand_protection	warn	t	2026-04-04 11:39:03.239706
231	brand	Toshiba	\N	Technology - VeRO participant	brand_protection	warn	t	2026-04-04 11:39:03.239706
232	brand	Huawei	\N	Technology - VeRO participant	brand_protection	warn	t	2026-04-04 11:39:03.239706
233	brand	OnePlus	\N	Technology - VeRO participant	brand_protection	warn	t	2026-04-04 11:39:03.239706
234	brand	Xiaomi	\N	Technology - VeRO participant	brand_protection	warn	t	2026-04-04 11:39:03.239706
237	brand	Marshall	\N	Audio - VeRO participant	brand_protection	warn	t	2026-04-04 11:39:03.239706
238	brand	Sennheiser	\N	Audio - VeRO participant	brand_protection	warn	t	2026-04-04 11:39:03.239706
240	brand	Logitech	\N	Technology - VeRO participant	brand_protection	warn	t	2026-04-04 11:39:03.239706
241	brand	Razer	\N	Gaming peripherals - VeRO participant	brand_protection	warn	t	2026-04-04 11:39:03.239706
242	brand	SteelSeries	\N	Gaming peripherals - VeRO participant	brand_protection	warn	t	2026-04-04 11:39:03.239706
243	brand	Corsair	\N	Gaming peripherals - VeRO participant	brand_protection	warn	t	2026-04-04 11:39:03.239706
245	brand	Nest	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 11:39:03.239706
236	brand	Bang & Olufsen	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 11:39:03.239706
246	brand	Amazon Echo	\N	Smart home - VeRO participant	brand_protection	warn	t	2026-04-04 11:39:03.239706
247	brand	Alexa	\N	Smart home - VeRO participant	brand_protection	warn	t	2026-04-04 11:39:03.239706
248	brand	Roku	\N	Streaming - VeRO participant	brand_protection	warn	t	2026-04-04 11:39:03.239706
249	brand	Epson	\N	Printers - VeRO participant	brand_protection	warn	t	2026-04-04 11:39:03.239706
250	brand	Brother	\N	Printers - VeRO participant	brand_protection	warn	t	2026-04-04 11:39:03.239706
251	brand	SanDisk	\N	Storage - VeRO participant	brand_protection	warn	t	2026-04-04 11:39:03.239706
252	brand	Western Digital	\N	Storage - VeRO participant	brand_protection	warn	t	2026-04-04 11:39:03.239706
253	brand	Seagate	\N	Storage - VeRO participant	brand_protection	warn	t	2026-04-04 11:39:03.239706
254	brand	Kingston	\N	Storage - VeRO participant	brand_protection	warn	t	2026-04-04 11:39:03.239706
255	brand	Zara	\N	Fashion - VeRO participant	brand_protection	warn	t	2026-04-04 11:39:22.870633
256	brand	H&M	\N	Fashion - VeRO participant	brand_protection	warn	t	2026-04-04 11:39:22.870633
257	brand	ASOS	\N	Fashion - VeRO participant	brand_protection	warn	t	2026-04-04 11:39:22.870633
261	brand	Levi's	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 11:39:22.870633
259	brand	Hollister	\N	Fashion - VeRO participant	brand_protection	warn	t	2026-04-04 11:39:22.870633
260	brand	Gap	\N	Fashion - VeRO participant	brand_protection	warn	t	2026-04-04 11:39:22.870633
262	brand	Levis	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 11:39:22.870633
290	brand	Osprey	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 11:39:22.870633
263	brand	Wrangler	\N	Fashion - VeRO participant	brand_protection	warn	t	2026-04-04 11:39:22.870633
264	brand	True Religion	\N	Fashion - VeRO participant	brand_protection	warn	t	2026-04-04 11:39:22.870633
265	brand	G-Star Raw	\N	Fashion - VeRO participant	brand_protection	warn	t	2026-04-04 11:39:22.870633
266	brand	Diesel	\N	Fashion - VeRO participant	brand_protection	warn	t	2026-04-04 11:39:22.870633
267	brand	Guess	\N	Fashion - VeRO participant	brand_protection	warn	t	2026-04-04 11:39:22.870633
269	brand	Berghaus	\N	Outdoor fashion - VeRO participant	brand_protection	warn	t	2026-04-04 11:39:22.870633
270	brand	Arc'teryx	\N	Outdoor fashion - VeRO participant	brand_protection	warn	t	2026-04-04 11:39:22.870633
271	brand	Arcteryx	\N	Outdoor fashion - VeRO participant	brand_protection	warn	t	2026-04-04 11:39:22.870633
272	brand	Napapijri	\N	Fashion - VeRO participant	brand_protection	warn	t	2026-04-04 11:39:22.870633
273	brand	Timberland	\N	Footwear/Fashion - VeRO participant	brand_protection	warn	t	2026-04-04 11:39:22.870633
274	brand	Skechers	\N	Footwear - VeRO participant	brand_protection	warn	t	2026-04-04 11:39:22.870633
275	brand	ASICS	\N	Footwear/Sports - VeRO participant	brand_protection	warn	t	2026-04-04 11:39:22.870633
276	brand	Jordan	\N	Footwear/Sports - VeRO participant	brand_protection	warn	t	2026-04-04 11:39:22.870633
277	brand	Air Jordan	\N	Footwear/Sports - VeRO participant	brand_protection	warn	t	2026-04-04 11:39:22.870633
278	brand	Clarks	\N	Footwear - VeRO participant	brand_protection	warn	t	2026-04-04 11:39:22.870633
279	brand	ECCO	\N	Footwear - VeRO participant	brand_protection	warn	t	2026-04-04 11:39:22.870633
291	brand	Samsonite	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 11:39:22.870633
293	brand	Tumi	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 11:39:22.870633
244	brand	Ring	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 11:39:03.239706
294	brand	Casio	\N	Watches - VeRO participant	brand_protection	warn	t	2026-04-04 11:39:22.870633
295	brand	Seiko	\N	Watches - VeRO participant	brand_protection	warn	t	2026-04-04 11:39:22.870633
296	brand	Citizen	\N	Watches - VeRO participant	brand_protection	warn	t	2026-04-04 11:39:22.870633
297	brand	Tissot	\N	Watches - VeRO participant	brand_protection	warn	t	2026-04-04 11:39:22.870633
288	brand	Furla	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 11:39:22.870633
289	brand	Longchamp	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 11:39:22.870633
305	brand	G-Shock	\N	Watches - VeRO participant	brand_protection	warn	t	2026-04-04 11:39:22.870633
309	brand	Callaway	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 11:39:58.733093
327	brand	iRobot	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 11:39:58.733093
328	brand	Roomba	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 11:39:58.733093
300	brand	IWC	\N	Watches - VeRO participant	brand_protection	block	t	2026-04-04 11:39:22.870633
307	brand	Theragun	\N	Fitness - VeRO participant	brand_protection	warn	t	2026-04-04 11:39:58.733093
308	brand	Bowflex	\N	Fitness - VeRO participant	brand_protection	warn	t	2026-04-04 11:39:58.733093
311	brand	Titleist	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 11:39:58.733093
313	brand	Speedo	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 11:39:58.733093
318	brand	Shimano	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 11:39:58.733093
312	brand	Ping	\N	Golf - VeRO participant	brand_protection	warn	t	2026-04-04 11:39:58.733093
319	brand	Specialized	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 11:39:58.733093
314	brand	Spalding	\N	Sports - VeRO participant	brand_protection	warn	t	2026-04-04 11:39:58.733093
315	brand	Wilson	\N	Sports - VeRO participant	brand_protection	warn	t	2026-04-04 11:39:58.733093
316	brand	Yonex	\N	Sports - VeRO participant	brand_protection	warn	t	2026-04-04 11:39:58.733093
317	brand	HEAD	\N	Sports - VeRO participant	brand_protection	warn	t	2026-04-04 11:39:58.733093
320	brand	Trek	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 11:39:58.733093
352	brand	Johnson & Johnson	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 11:39:58.733093
321	brand	Breville	\N	Kitchen - VeRO participant	brand_protection	warn	t	2026-04-04 11:39:58.733093
322	brand	Kenwood	\N	Kitchen - VeRO participant	brand_protection	warn	t	2026-04-04 11:39:58.733093
323	brand	Nutribullet	\N	Kitchen - VeRO participant	brand_protection	warn	t	2026-04-04 11:39:58.733093
324	brand	NutriBullet	\N	Kitchen - VeRO participant	brand_protection	warn	t	2026-04-04 11:39:58.733093
325	brand	Vitamix	\N	Kitchen - VeRO participant	brand_protection	warn	t	2026-04-04 11:39:58.733093
326	brand	Shark	\N	Home appliances - VeRO participant	brand_protection	warn	t	2026-04-04 11:39:58.733093
350	brand	Snap On	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 11:39:58.733093
361	brand	Red Bull	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 11:39:58.733093
329	brand	Ninja	\N	Kitchen - VeRO participant	brand_protection	warn	t	2026-04-04 11:39:58.733093
330	brand	Instant Pot	\N	Kitchen - VeRO participant	brand_protection	warn	t	2026-04-04 11:39:58.733093
331	brand	Nespresso	\N	Kitchen - VeRO participant	brand_protection	warn	t	2026-04-04 11:39:58.733093
332	brand	De'Longhi	\N	Kitchen - VeRO participant	brand_protection	warn	t	2026-04-04 11:39:58.733093
334	brand	Sage	\N	Kitchen - VeRO participant	brand_protection	warn	t	2026-04-04 11:39:58.733093
335	brand	Smeg	\N	Kitchen - VeRO participant	brand_protection	warn	t	2026-04-04 11:39:58.733093
336	brand	Dualit	\N	Kitchen - VeRO participant	brand_protection	warn	t	2026-04-04 11:39:58.733093
337	brand	Russell Hobbs	\N	Kitchen - VeRO participant	brand_protection	warn	t	2026-04-04 11:39:58.733093
338	brand	Tefal	\N	Kitchen - VeRO participant	brand_protection	warn	t	2026-04-04 11:39:58.733093
339	brand	Morphy Richards	\N	Kitchen - VeRO participant	brand_protection	warn	t	2026-04-04 11:39:58.733093
340	brand	Miele	\N	Home appliances - VeRO participant	brand_protection	warn	t	2026-04-04 11:39:58.733093
341	brand	Karcher	\N	Home appliances - VeRO participant	brand_protection	warn	t	2026-04-04 11:39:58.733093
342	brand	Kärcher	\N	Home appliances - VeRO participant	brand_protection	warn	t	2026-04-04 11:39:58.733093
343	brand	Hoover	\N	Home appliances - VeRO participant	brand_protection	warn	t	2026-04-04 11:39:58.733093
344	brand	Vax	\N	Home appliances - VeRO participant	brand_protection	warn	t	2026-04-04 11:39:58.733093
345	brand	BISSELL	\N	Home appliances - VeRO participant	brand_protection	warn	t	2026-04-04 11:39:58.733093
346	brand	Bosch Auto	\N	Automotive - VeRO participant	brand_protection	warn	t	2026-04-04 11:39:58.733093
347	brand	Brembo	\N	Automotive - VeRO participant	brand_protection	warn	t	2026-04-04 11:39:58.733093
348	brand	Denso	\N	Automotive - VeRO participant	brand_protection	warn	t	2026-04-04 11:39:58.733093
349	brand	Thule	\N	Automotive accessories - VeRO participant	brand_protection	warn	t	2026-04-04 11:39:58.733093
363	brand	Coca-Cola	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 11:39:58.733093
351	brand	Halfords	\N	Automotive - VeRO participant	brand_protection	warn	t	2026-04-04 11:39:58.733093
353	brand	Bayer	\N	Pharmaceuticals - VeRO participant	brand_protection	warn	t	2026-04-04 11:39:58.733093
354	brand	Pfizer	\N	Pharmaceuticals - VeRO participant	brand_protection	warn	t	2026-04-04 11:39:58.733093
355	brand	GSK	\N	Pharmaceuticals - VeRO participant	brand_protection	warn	t	2026-04-04 11:39:58.733093
356	brand	GlaxoSmithKline	\N	Pharmaceuticals - VeRO participant	brand_protection	warn	t	2026-04-04 11:39:58.733093
357	brand	Durex	\N	Health - VeRO participant	brand_protection	warn	t	2026-04-04 11:39:58.733093
358	brand	Cadbury	\N	Food - VeRO participant	brand_protection	warn	t	2026-04-04 11:39:58.733093
359	brand	Nestlé	\N	Food - VeRO participant	brand_protection	warn	t	2026-04-04 11:39:58.733093
360	brand	Nestle	\N	Food - VeRO participant	brand_protection	warn	t	2026-04-04 11:39:58.733093
306	brand	Peloton	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 11:39:58.733093
364	brand	Pepsi	\N	Beverage - VeRO participant	brand_protection	warn	t	2026-04-04 11:39:58.733093
365	brand	Jack Daniels	\N	Alcohol - VeRO participant	brand_protection	warn	t	2026-04-04 11:39:58.733093
366	brand	Guinness	\N	Alcohol - VeRO participant	brand_protection	warn	t	2026-04-04 11:39:58.733093
298	brand	Longines	\N	Watches - VeRO participant	brand_protection	warn	t	2026-04-04 11:39:22.870633
302	brand	Tudor	\N	Watches - VeRO participant	brand_protection	warn	t	2026-04-04 11:39:22.870633
303	brand	Daniel Wellington	\N	Watches - VeRO participant	brand_protection	warn	t	2026-04-04 11:39:22.870633
304	brand	Fossil	\N	Watches - VeRO participant	brand_protection	warn	t	2026-04-04 11:39:22.870633
9	brand	Versace	\N	Luxury goods - VeRO participant	brand_protection	block	t	2026-04-04 10:24:10.05741
130	brand	Alexander McQueen	\N	Luxury goods - VeRO participant	brand_protection	block	t	2026-04-04 10:24:10.360481
121	brand	Off-White	\N	Streetwear - VeRO participant	brand_protection	block	t	2026-04-04 10:24:10.342069
280	brand	Salvatore Ferragamo	\N	Luxury goods - VeRO participant	brand_protection	block	t	2026-04-04 11:39:22.870633
299	brand	Hublot	\N	Watches - VeRO participant	brand_protection	block	t	2026-04-04 11:39:22.870633
301	brand	Audemars Piguet	\N	Watches - VeRO participant	brand_protection	block	t	2026-04-04 11:39:22.870633
373	brand	David Yurman	\N	Jewellery - VeRO participant	brand_protection	block	t	2026-04-04 11:39:58.733093
376	brand	Chopard	\N	Jewellery/Watches - VeRO participant	brand_protection	block	t	2026-04-04 11:39:58.733093
377	brand	Van Cleef & Arpels	\N	Jewellery - VeRO participant	brand_protection	block	t	2026-04-04 11:39:58.733093
378	brand	Graff	\N	Jewellery - VeRO participant	brand_protection	block	t	2026-04-04 11:39:58.733093
202	brand	Chanel No. 5	\N	Fragrance - VeRO participant	brand_protection	block	t	2026-04-04 11:39:03.239706
381	brand	Gucci Eyewear	\N	Eyewear - VeRO participant	brand_protection	block	t	2026-04-04 11:39:58.733093
382	brand	Prada Eyewear	\N	Eyewear - VeRO participant	brand_protection	block	t	2026-04-04 11:39:58.733093
367	brand	Johnnie Walker	\N	Alcohol - VeRO participant	brand_protection	warn	t	2026-04-04 11:39:58.733093
370	brand	Steam	\N	Gaming - VeRO participant	brand_protection	warn	t	2026-04-04 11:39:58.733093
371	brand	Epic Games	\N	Gaming - VeRO participant	brand_protection	warn	t	2026-04-04 11:39:58.733093
372	brand	Roblox	\N	Gaming - VeRO participant	brand_protection	warn	t	2026-04-04 11:39:58.733093
374	brand	Links of London	\N	Jewellery - VeRO participant	brand_protection	warn	t	2026-04-04 11:39:58.733093
375	brand	Thomas Sabo	\N	Jewellery - VeRO participant	brand_protection	warn	t	2026-04-04 11:39:58.733093
379	brand	Persol	\N	Eyewear - VeRO participant	brand_protection	warn	t	2026-04-04 11:39:58.733093
380	brand	Tom Ford Eyewear	\N	Eyewear - VeRO participant	brand_protection	warn	t	2026-04-04 11:39:58.733093
383	brand	Maui Jim	\N	Eyewear - VeRO participant	brand_protection	warn	t	2026-04-04 11:39:58.733093
385	brand	Hills	\N	Pet food - VeRO participant	brand_protection	warn	t	2026-04-04 11:39:58.733093
386	brand	Montblanc Pen	\N	Luxury goods - VeRO participant	brand_protection	warn	t	2026-04-04 11:39:58.733093
387	brand	Parker Pen	\N	Stationery - VeRO participant	brand_protection	warn	t	2026-04-04 11:39:58.733093
388	brand	Cross Pen	\N	Stationery - VeRO participant	brand_protection	warn	t	2026-04-04 11:39:58.733093
368	brand	PlayStation	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 11:39:58.733093
369	brand	Xbox	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 11:39:58.733093
384	brand	Royal Canin	\N	VeRO protected brand — actively enforced	brand_protection	block	t	2026-04-04 11:39:58.733093
\.


--
-- Data for Name: import_jobs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.import_jobs (id, user_id, vendor_id, source, file_name, field_mapping, status, total_rows, processed_rows, success_count, error_count, errors, created_at, completed_at) FROM stdin;
\.


--
-- Data for Name: marketplace_listings; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.marketplace_listings (id, store_id, product_id, external_id, status, sync_status, last_sync, listing_url, stock_status, out_of_stock_at) FROM stdin;
\.


--
-- Data for Name: messages; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.messages (id, conversation_id, role, content, created_at) FROM stdin;
\.


--
-- Data for Name: notifications; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.notifications (id, user_id, type, title, message, order_id, read, created_at) FROM stdin;
\.


--
-- Data for Name: orders; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.orders (id, user_id, store_id, external_order_id, customer_name, customer_email, shipping_address, total_amount, status, fulfillment_status, tracking_number, carrier, created_at, updated_at, line_items, tracking_status, tracking_url, tracking_updated_at) FROM stdin;
\.


--
-- Data for Name: payment_cards; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.payment_cards (id, user_id, last_four, brand, expiry_month, expiry_year, tokenized_id, is_default, priority, status, created_at) FROM stdin;
\.


--
-- Data for Name: paypal_payout_accruals; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.paypal_payout_accruals (id, user_id, recipient_handle, month_year, amount_pence, status, settled_at, settled_by_user_id, settled_note, created_at) FROM stdin;
\.


--
-- Data for Name: pricing_rules; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.pricing_rules (id, user_id, name, rule_type, value, min_price, max_price, apply_to_vendor, apply_to_category, priority, is_active, created_at) FROM stdin;
\.


--
-- Data for Name: product_variations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.product_variations (id, product_id, name, sku, price, stock, image, attributes, external_id, sort_order, created_at) FROM stdin;
\.


--
-- Data for Name: products; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.products (id, user_id, vendor_id, title, description, sku, cost_price, selling_price, quantity, images, attributes, vero_status, created_at, updated_at, delivery_type, delivery_cost, brand, vero_override, vero_override_by, vero_override_reason, listed_by_freelancer_id, external_product_id, marketplace_price, marketplace_stock_status, shipping_info, last_marketplace_sync) FROM stdin;
6	test-user-001	\N	Test		DS-MLZKZILR	0.00	0.00	0	{}	\N	clean	2026-02-23 19:40:04.722774	2026-02-23 19:40:04.722774	buyer_pays	0.00		f	\N	\N	\N	\N	\N	unknown	\N	\N
5	test-user-001	3	Test Extension Import	Test description	EXT-TEST-001	10.00	15.00	0	{https://example.com/img.jpg}	{"sourceUrl": "https://www.amazon.co.uk/dp/B0TEST123", "vendorStock": {"error": "Vendor returned 503", "inStock": true, "quantity": null, "autoPaused": true, "confidence": "medium", "lastChecked": "2026-06-29T21:01:34.592Z", "autoPausedAt": "2026-06-29T19:16:34.743Z", "currentPrice": null, "lastScrapedAt": null, "wasAutoPaused": true, "lastScrapedPrice": null, "failedScrapeCount": 1, "lastSuccessfulCheck": "2026-06-29T20:46:34.749Z", "consecutiveSuccessfulScrapes": 0}}	clean	2026-02-23 17:19:22.152333	2026-02-23 17:19:22.152333	buyer_pays	3.99		f	\N	\N	\N	\N	\N	unknown	\N	2026-07-02 15:56:59.646
\.


--
-- Data for Name: publish_queue; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.publish_queue (id, user_id, product_id, store_id, calculated_price, pricing_rule_id, status, error_message, scheduled_at, published_at, created_at, quantity, ai_description, postage_type, postage_cost) FROM stdin;
\.


--
-- Data for Name: referrals; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.referrals (id, referrer_id, referred_user_id, status, total_earnings, created_at, cycles_credited) FROM stdin;
\.


--
-- Data for Name: restock_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.restock_logs (id, store_id, product_id, previous_quantity, new_quantity, marketplace_listing_id, triggered_by, created_at) FROM stdin;
\.


--
-- Data for Name: restricted_products; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.restricted_products (id, user_id, category, keyword, jurisdiction, reason, is_active, created_at) FROM stdin;
\.


--
-- Data for Name: return_requests; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.return_requests (id, user_id, order_id, fulfillment_job_id, reason, status, vendor_return_id, refund_amount, notes, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: sessions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.sessions (sid, sess, expire) FROM stdin;
ignveRKiVYnBtKe8nJkHBmzEw6DgHR0r	{"cookie": {"path": "/", "secure": true, "expires": "2026-02-23T00:29:14.635Z", "httpOnly": true, "originalMaxAge": 604800000}, "userId": "test-user-001"}	2026-02-23 00:29:15
hdFGr7NSXDj7FR8xEnlS-DyXG8ZZP3vX	{"cookie": {"path": "/", "secure": true, "expires": "2026-02-23T00:29:33.007Z", "httpOnly": true, "originalMaxAge": 604800000}, "userId": "test-user-001"}	2026-02-23 00:29:34
KC_blnZ2KSE7i-lZGJK0z4ILpnPiMFoZ	{"cookie": {"path": "/", "secure": true, "expires": "2026-02-23T00:29:37.713Z", "httpOnly": true, "originalMaxAge": 604800000}, "userId": "test-user-001"}	2026-02-23 00:29:38
TYfhPc_rqDIWdt44AdTDvcRquEKb3oG0	{"cookie": {"path": "/", "secure": true, "expires": "2026-02-23T00:33:47.116Z", "httpOnly": true, "originalMaxAge": 604800000}, "userId": "test-user-001"}	2026-02-23 00:33:48
testsid-HYEvn24Bwx6MTscN	{"cookie": {"path": "/", "expires": null, "httpOnly": true, "originalMaxAge": null}, "passport": {"user": "test-lister-uid-f84212f"}}	2026-05-05 15:07:06.19351
p6MJ6JS3z-ktjjEfIf8zKroTbMd9Kwnp	{"cookie": {"path": "/", "secure": true, "expires": "2026-05-03T15:24:21.762Z", "httpOnly": true, "originalMaxAge": 604800000}, "passport": {"user": {"claims": {"aud": "165625f1-68ce-4c7b-af24-240466ac94ad", "exp": 1777220661, "iat": 1777217061, "iss": "https://test-mock-oidc.replit.app/", "jti": "0ec7da7041087e515c0af57b065fded3", "sub": "test-extcreds-1777217044521", "email": "extcreds+1777217044521@example.com", "auth_time": 1777217061, "last_name": "Doe", "first_name": "John"}, "expires_at": 1777220661, "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6Ijc4MDgyZTlmZjVhOTA1YjIifQ.eyJpc3MiOiJodHRwczovL3Rlc3QtbW9jay1vaWRjLnJlcGxpdC5hcHAvIiwiaWF0IjoxNzc3MjE3MDYxLCJleHAiOjE3NzcyMjA2NjEsInN1YiI6InRlc3QtZXh0Y3JlZHMtMTc3NzIxNzA0NDUyMSIsImVtYWlsIjoiZXh0Y3JlZHMrMTc3NzIxNzA0NDUyMUBleGFtcGxlLmNvbSIsImZpcnN0X25hbWUiOiJKb2huIiwibGFzdF9uYW1lIjoiRG9lIn0.DMDBFQmzTW2Ly9nas-5ZWqO3Z1Moezg5LyUht-grGiKs0e1lpaz2qeOpxbWYMJGXO0abz2q6XxhcaoN1mnATLOEErr6HA6geZQ36i0RcubjBvF2_I0I1Dv42yCMYXf33E-GIG5LKz8HsYiVm8tYqHJwNyt8uVqiteat-_BYsWxZ-Ek_iaO7lVNT_iGZFI4kCKfADI--CQWOaazTsvHuSBUK6i2ggP6F0zhhZbOg2ujbV89Z3iMaBG3x8hmSk3JHiybEXfwmybL-t38phMUX_Xpbe9Y_h_voBGg81doXrbhRz2aHPEmxACfUYt4loLVdwN48c74tkSQeKCuQbIle9wA", "refresh_token": "eyJzdWIiOiJ0ZXN0LWV4dGNyZWRzLTE3NzcyMTcwNDQ1MjEiLCJlbWFpbCI6ImV4dGNyZWRzKzE3NzcyMTcwNDQ1MjFAZXhhbXBsZS5jb20iLCJmaXJzdF9uYW1lIjoiSm9obiIsImxhc3RfbmFtZSI6IkRvZSJ9"}}}	2026-05-03 15:26:10
_uqSBLDYfkanE2_xxH7tHdV1D8-16Y3l	{"cookie": {"path": "/", "secure": true, "expires": "2026-05-03T15:10:55.488Z", "httpOnly": true, "originalMaxAge": 604800000}, "passport": {"user": {"claims": {"aud": "165625f1-68ce-4c7b-af24-240466ac94ad", "exp": 1777219855, "iat": 1777216255, "iss": "https://test-mock-oidc.replit.app/", "jti": "c5b9887d464b4cb0f6615fb482dd90f0", "sub": "test-toggleoff-1777216241036", "email": "toggleoff+1777216241036@example.com", "auth_time": 1777216255, "last_name": "Doe", "first_name": "John"}, "expires_at": 1777219855, "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6Ijc4MDgyZTlmZjVhOTA1YjIifQ.eyJpc3MiOiJodHRwczovL3Rlc3QtbW9jay1vaWRjLnJlcGxpdC5hcHAvIiwiaWF0IjoxNzc3MjE2MjU1LCJleHAiOjE3NzcyMTk4NTUsInN1YiI6InRlc3QtdG9nZ2xlb2ZmLTE3NzcyMTYyNDEwMzYiLCJlbWFpbCI6InRvZ2dsZW9mZisxNzc3MjE2MjQxMDM2QGV4YW1wbGUuY29tIiwiZmlyc3RfbmFtZSI6IkpvaG4iLCJsYXN0X25hbWUiOiJEb2UifQ.KwIKA6sOSsFI8l4IzSFgRClUn5-5K-9rgWIhpSzm2UJtkO-AO2sbQyDJy9JeY16BsSsZmVK7ejGDm0ILTMlateghI_unVavscIkFJrK2qXnWunPHM-TeoPuvwDC9wu3ozvyt_hrDd6tdJDQSdMJIROSyM8xJhtUqjZbc4FBMOrOrw-OR0DDj9SpXlHhZKKUsqnoxm58f2fXg4DZ1ExBH3hNfII02c6WWWcgimldgJ4q0-D26fzkjKIODkBS3u3WD7qcasF-veTmjArGqKk0_FvITEwELHLRpOJVE85I_JETPA9JwpWodjYxfxT39WkhV31WmyGjhbg3ni-sKRmxFLg", "refresh_token": "eyJzdWIiOiJ0ZXN0LXRvZ2dsZW9mZi0xNzc3MjE2MjQxMDM2IiwiZW1haWwiOiJ0b2dnbGVvZmYrMTc3NzIxNjI0MTAzNkBleGFtcGxlLmNvbSIsImZpcnN0X25hbWUiOiJKb2huIiwibGFzdF9uYW1lIjoiRG9lIn0"}}}	2026-05-03 15:12:12
MC9AQ6SuSduE11zn69e6HIcHb2dlSyk_	{"cookie": {"path": "/", "secure": true, "expires": "2026-05-03T15:41:24.085Z", "httpOnly": true, "originalMaxAge": 604800000}, "passport": {"user": {"claims": {"aud": "165625f1-68ce-4c7b-af24-240466ac94ad", "exp": 1777221684, "iat": 1777218084, "iss": "https://test-mock-oidc.replit.app/", "jti": "68c40237509d7c8d1fbb2a96b8ff41e8", "sub": "test-final-1777218061987", "email": "final+1777218061987@example.com", "auth_time": 1777218084, "last_name": "Doe", "first_name": "John"}, "expires_at": 1777221684, "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6Ijc4MDgyZTlmZjVhOTA1YjIifQ.eyJpc3MiOiJodHRwczovL3Rlc3QtbW9jay1vaWRjLnJlcGxpdC5hcHAvIiwiaWF0IjoxNzc3MjE4MDg0LCJleHAiOjE3NzcyMjE2ODQsInN1YiI6InRlc3QtZmluYWwtMTc3NzIxODA2MTk4NyIsImVtYWlsIjoiZmluYWwrMTc3NzIxODA2MTk4N0BleGFtcGxlLmNvbSIsImZpcnN0X25hbWUiOiJKb2huIiwibGFzdF9uYW1lIjoiRG9lIn0.Si3h_IegobGox7pG9o_cXEnVDk0AeIGmXLj69ytveqXNyNTar8sm2Rr8-vGB67PkWp01b-OMESG2AADRp8-1cf5Cnx539DD38JguTao7w2KCAqvTn27AWiSfXMc06kgXXTnfKyasMPwinSoxcBNwOcsww5APIsi0Uj1DA6gO1ER0xKOfpn5iTesm82_FmxjKLr_RPSQqJxgtMu4PC4Li9QGMndMBP0It-2BiopEskwdKDTNJwVE5RXLuK2matWaNYRS-39Bxj9hg3NFlHMUlHPfMhya7itQtUF42FJc6dD1XIQ_d6VxMeQpVP50K3zMkkkxKPwEf99SP28gydRzSXg", "refresh_token": "eyJzdWIiOiJ0ZXN0LWZpbmFsLTE3NzcyMTgwNjE5ODciLCJlbWFpbCI6ImZpbmFsKzE3NzcyMTgwNjE5ODdAZXhhbXBsZS5jb20iLCJmaXJzdF9uYW1lIjoiSm9obiIsImxhc3RfbmFtZSI6IkRvZSJ9"}}}	2026-05-03 15:42:17
mi81EO2YxWFTtXFKuFvW9IU-PLtkZQ2P	{"cookie": {"path": "/", "secure": true, "expires": "2026-05-03T15:27:15.282Z", "httpOnly": true, "originalMaxAge": 604800000}, "passport": {"user": {"claims": {"aud": "165625f1-68ce-4c7b-af24-240466ac94ad", "exp": 1777220835, "iat": 1777217235, "iss": "https://test-mock-oidc.replit.app/", "jti": "023d295e9c44b4774cdc76af65843d83", "sub": "test-extok-1777217220294", "email": "extok+1777217220294@example.com", "auth_time": 1777217235, "last_name": "Doe", "first_name": "John"}, "expires_at": 1777220835, "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6Ijc4MDgyZTlmZjVhOTA1YjIifQ.eyJpc3MiOiJodHRwczovL3Rlc3QtbW9jay1vaWRjLnJlcGxpdC5hcHAvIiwiaWF0IjoxNzc3MjE3MjM1LCJleHAiOjE3NzcyMjA4MzUsInN1YiI6InRlc3QtZXh0b2stMTc3NzIxNzIyMDI5NCIsImVtYWlsIjoiZXh0b2srMTc3NzIxNzIyMDI5NEBleGFtcGxlLmNvbSIsImZpcnN0X25hbWUiOiJKb2huIiwibGFzdF9uYW1lIjoiRG9lIn0.dmPRXmpwsAdym-B54ltJOeqM_GiOB8lISkz1D4pygJqk-ShCz0EtAPFdkI_N1PaSdbIuCSPyyW5hlBQvnO0dH7g29JQAjQWmw0fqufpLqZuG6og-aOOnM_l-7-OCk2VKtHv6CNAVlLsEUemLXWYeeI6-bbBQLF98VMdDhvN01atfWoUWaZaa3DvrN8E4kivbX4VMrVGcIqwoNe_23X0G-imh6izNStHC_0HLFkuo6S66NuImWORGB6EBFxyQY6OCTIJsfNMVyyJYM3hoEzXAcNAUZA4O3o3lnsTYeocX_HLKYHT1QIajhuZTNeLnuYVXyIYvruqqkP1xy_eIuMDf1A", "refresh_token": "eyJzdWIiOiJ0ZXN0LWV4dG9rLTE3NzcyMTcyMjAyOTQiLCJlbWFpbCI6ImV4dG9rKzE3NzcyMTcyMjAyOTRAZXhhbXBsZS5jb20iLCJmaXJzdF9uYW1lIjoiSm9obiIsImxhc3RfbmFtZSI6IkRvZSJ9"}}}	2026-05-03 15:28:18
i7tbgN9aU_SLh5PWorjOPjCj0ZE-dwkB	{"cookie": {"path": "/", "secure": true, "expires": "2026-05-03T15:37:33.813Z", "httpOnly": true, "originalMaxAge": 604800000}, "passport": {"user": {"claims": {"aud": "165625f1-68ce-4c7b-af24-240466ac94ad", "exp": 1777221453, "iat": 1777217853, "iss": "https://test-mock-oidc.replit.app/", "jti": "5db5886b0139c2e69a162a1608c84ada", "sub": "test-finalsec-1777217837615", "email": "finalsec+1777217837615@example.com", "auth_time": 1777217853, "last_name": "User", "first_name": "Test"}, "expires_at": 1777221453, "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6Ijc4MDgyZTlmZjVhOTA1YjIifQ.eyJpc3MiOiJodHRwczovL3Rlc3QtbW9jay1vaWRjLnJlcGxpdC5hcHAvIiwiaWF0IjoxNzc3MjE3ODUzLCJleHAiOjE3NzcyMjE0NTMsInN1YiI6InRlc3QtZmluYWxzZWMtMTc3NzIxNzgzNzYxNSIsImVtYWlsIjoiZmluYWxzZWMrMTc3NzIxNzgzNzYxNUBleGFtcGxlLmNvbSIsImZpcnN0X25hbWUiOiJUZXN0IiwibGFzdF9uYW1lIjoiVXNlciJ9.SEb6ZyD4zFrr7ZyYXdmBYW7jXG3Vfb1R5dGJC9llRUX6QzODxVcLTOqNSVaXZnJHuTTS6YFU20Wc2pjtAs1KFTAVO_LW8ZVQwpCZ0BkylSV2RBCGC0xuDuD7dHX72_i8ZELiush1hHsvcfawgmAjmWjLLLRJYvw8_gbO41Z-46_VtP08tEHsQrKbmUc7lVxHD20P2Pr3Utwz1v22OyFmSPgLqwERoASI42DV_E5ibYBARF66jhIDtaARaaXnmiEdPJO_hokd9MhLGuDwDljDgL7k4gfBeBoArmpzUjVl_JLqTLbVcm8us3_lGxt4v4reYW_-NDNodkUBp2fsicBZ2A", "refresh_token": "eyJzdWIiOiJ0ZXN0LWZpbmFsc2VjLTE3NzcyMTc4Mzc2MTUiLCJlbWFpbCI6ImZpbmFsc2VjKzE3NzcyMTc4Mzc2MTVAZXhhbXBsZS5jb20iLCJmaXJzdF9uYW1lIjoiVGVzdCIsImxhc3RfbmFtZSI6IlVzZXIifQ"}}}	2026-05-03 15:38:47
87VdamYT8SdQBYZRjs-OIROK4TDkhmth	{"cookie": {"path": "/", "secure": true, "expires": "2026-05-03T15:32:28.005Z", "httpOnly": true, "originalMaxAge": 604800000}, "passport": {"user": {"claims": {"aud": "165625f1-68ce-4c7b-af24-240466ac94ad", "exp": 1777221147, "iat": 1777217547, "iss": "https://test-mock-oidc.replit.app/", "jti": "737d8aa96db9f2d518f3593d18d2bfc1", "sub": "test-extsec-1777217529961", "email": "extsec+1777217529961@example.com", "auth_time": 1777217547, "last_name": "User", "first_name": "Test"}, "expires_at": 1777221147, "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6Ijc4MDgyZTlmZjVhOTA1YjIifQ.eyJpc3MiOiJodHRwczovL3Rlc3QtbW9jay1vaWRjLnJlcGxpdC5hcHAvIiwiaWF0IjoxNzc3MjE3NTQ3LCJleHAiOjE3NzcyMjExNDcsInN1YiI6InRlc3QtZXh0c2VjLTE3NzcyMTc1Mjk5NjEiLCJlbWFpbCI6ImV4dHNlYysxNzc3MjE3NTI5OTYxQGV4YW1wbGUuY29tIiwiZmlyc3RfbmFtZSI6IlRlc3QiLCJsYXN0X25hbWUiOiJVc2VyIn0.XLbs4Fcj9kO885k1BuahfupOvReMkU7twslEHZAR60-jCSOIg9UxO4JlieWYJTkGYyKkCXHRNzAwE8WNdgODzbd_-KSiKR0ScBNQMBjFYB0vWgJ6N76AdlV9eFvUSugkeI1Sz1wYAFy9Yq9Y_fd89A-lYk582Qgwsl7H2wQILmxvuLZSEF7dDavb1GdtsW0vkDdmv4BiFJDAaIvf8TCHdAGpCEkN7wYSXo5OU2Bj24SoB9uHtYemtNgcAqjpdJoGyIUWfHgjYoQ5cnFwTd56sUO0ui81W3EZTEiLXcAVnFgH-HgHGDtuGKIHsCAa5USdVJrHd-IDKth077_uVQ1o4Q", "refresh_token": "eyJzdWIiOiJ0ZXN0LWV4dHNlYy0xNzc3MjE3NTI5OTYxIiwiZW1haWwiOiJleHRzZWMrMTc3NzIxNzUyOTk2MUBleGFtcGxlLmNvbSIsImZpcnN0X25hbWUiOiJUZXN0IiwibGFzdF9uYW1lIjoiVXNlciJ9"}}}	2026-05-03 15:33:41
G_Bv-HcY95ftfCdrJMzE_c4QZ4S2Xht3	{"cookie": {"path": "/", "secure": true, "expires": "2026-05-03T15:05:55.806Z", "httpOnly": true, "originalMaxAge": 604800000}, "passport": {"user": {"claims": {"aud": "165625f1-68ce-4c7b-af24-240466ac94ad", "exp": 1777219555, "iat": 1777215955, "iss": "https://test-mock-oidc.replit.app/", "jti": "d6f15dd64a33f25b8afdade43f2c6cf6", "sub": "test-srules-1777215936261", "email": "srules+1777215936261@example.com", "auth_time": 1777215955, "last_name": "Tester", "first_name": "Store"}, "expires_at": 1777219555, "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6Ijc4MDgyZTlmZjVhOTA1YjIifQ.eyJpc3MiOiJodHRwczovL3Rlc3QtbW9jay1vaWRjLnJlcGxpdC5hcHAvIiwiaWF0IjoxNzc3MjE1OTU1LCJleHAiOjE3NzcyMTk1NTUsInN1YiI6InRlc3Qtc3J1bGVzLTE3NzcyMTU5MzYyNjEiLCJlbWFpbCI6InNydWxlcysxNzc3MjE1OTM2MjYxQGV4YW1wbGUuY29tIiwiZmlyc3RfbmFtZSI6IlN0b3JlIiwibGFzdF9uYW1lIjoiVGVzdGVyIn0.cdKVSdQ_jkzMZ1YTehWsHySYc1ZPOgxz1XfNIf9oSuoU4hMXzj4gkFgpEFrqtg6_EGsSayvVu-5T_BlSOc3Uq2cWKyxrKCAwZevVLREyYokvbOo98Jtc27ddEwLdnAhj0nvf24gn2g6oOiHncHcJEMPmXt8VyS4JPeBR0Ec1kvkRR_tqvL-I2XL9-AC1FYIi_aid6y_i-QOA6BnsrwFAlgE9pEAvjPE4rLUOBV7gtdaxXkssJp4_iKf8nyqbRWwdhqckBR12RhLAK__G2FaEldFRVTQdm_MKGFLKoY1xiuFVUwYR_k8B91GEw8h-9mUn5sCd0Dy0Tr8uelgXhiOhZw", "refresh_token": "eyJzdWIiOiJ0ZXN0LXNydWxlcy0xNzc3MjE1OTM2MjYxIiwiZW1haWwiOiJzcnVsZXMrMTc3NzIxNTkzNjI2MUBleGFtcGxlLmNvbSIsImZpcnN0X25hbWUiOiJTdG9yZSIsImxhc3RfbmFtZSI6IlRlc3RlciJ9"}}}	2026-05-03 15:08:39
zsFYt8HK1AF0nhq7juQeCVMBL95ql3J3	{"cookie": {"path": "/", "secure": true, "expires": "2026-05-03T14:56:53.451Z", "httpOnly": true, "originalMaxAge": 604800000}, "passport": {"user": {"claims": {"aud": "165625f1-68ce-4c7b-af24-240466ac94ad", "exp": 1777219013, "iat": 1777215413, "iss": "https://test-mock-oidc.replit.app/", "jti": "0925d4add9b2d7509438c38f974ddc49", "sub": "test-storerules-1777215393655", "email": "storerules+1777215393655@example.com", "auth_time": 1777215413, "last_name": "Tester", "first_name": "Store"}, "expires_at": 1777219013, "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6Ijc4MDgyZTlmZjVhOTA1YjIifQ.eyJpc3MiOiJodHRwczovL3Rlc3QtbW9jay1vaWRjLnJlcGxpdC5hcHAvIiwiaWF0IjoxNzc3MjE1NDEzLCJleHAiOjE3NzcyMTkwMTMsInN1YiI6InRlc3Qtc3RvcmVydWxlcy0xNzc3MjE1MzkzNjU1IiwiZW1haWwiOiJzdG9yZXJ1bGVzKzE3NzcyMTUzOTM2NTVAZXhhbXBsZS5jb20iLCJmaXJzdF9uYW1lIjoiU3RvcmUiLCJsYXN0X25hbWUiOiJUZXN0ZXIifQ.TvnygJPcEQoe3kO5CoAbOHQZXsM23hQc-xpAgA0yWwR8XKJnojalYk-BzgYPnJhA9ohWDc8QikrvJ3Qao4lUAym06yNX0-qehj8yZaQhuZ4NRmyfeHI_GghnJkT4Cyk19SSAGY8yn3tGbpEGLUZUAWSQ-nXL8UV0TIbTmnfYJuaObf4UvaElqJ06PiUysgFVQeaNKxjWeEUOuREPvZEbFCEKfw7Hk534F0j2heRfYqkcf0WubB6WXVK95A-IHRMMEDvI4G_zbMrXfrLxj8z-pqCtzPiivbCvDnIssREvKKVjYMeIq_sNr0WHr5GLDJP3qkCn081jBfNkm_8RakroCg", "refresh_token": "eyJzdWIiOiJ0ZXN0LXN0b3JlcnVsZXMtMTc3NzIxNTM5MzY1NSIsImVtYWlsIjoic3RvcmVydWxlcysxNzc3MjE1MzkzNjU1QGV4YW1wbGUuY29tIiwiZmlyc3RfbmFtZSI6IlN0b3JlIiwibGFzdF9uYW1lIjoiVGVzdGVyIn0"}}}	2026-05-03 14:57:21
mNoPL1W7XFC5DZ5ov2Pjs98uJX2BnHnW	{"cookie": {"path": "/", "secure": true, "expires": "2026-05-03T15:22:38.567Z", "httpOnly": true, "originalMaxAge": 604800000}, "passport": {"user": {"claims": {"aud": "165625f1-68ce-4c7b-af24-240466ac94ad", "exp": 1777220558, "iat": 1777216958, "iss": "https://test-mock-oidc.replit.app/", "jti": "573dce3db3db8a0d9c6e486af31ec4b6", "sub": "test-extlink-1777216909226", "email": "extlink+1777216909226@example.com", "auth_time": 1777216958, "last_name": "Doe", "first_name": "John"}, "expires_at": 1777220558, "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6Ijc4MDgyZTlmZjVhOTA1YjIifQ.eyJpc3MiOiJodHRwczovL3Rlc3QtbW9jay1vaWRjLnJlcGxpdC5hcHAvIiwiaWF0IjoxNzc3MjE2OTU4LCJleHAiOjE3NzcyMjA1NTgsInN1YiI6InRlc3QtZXh0bGluay0xNzc3MjE2OTA5MjI2IiwiZW1haWwiOiJleHRsaW5rKzE3NzcyMTY5MDkyMjZAZXhhbXBsZS5jb20iLCJmaXJzdF9uYW1lIjoiSm9obiIsImxhc3RfbmFtZSI6IkRvZSJ9.CE5YTPdM_oj7Z64j5_3Aq6YRYVlHpO3-BGDORTo0C83dMq1s5OBZ9MyU-bUuDBWwDlfk3JdXXEuh6P_xXkbq_oWu-KVmetljr8J2WfSd8q0U1YY5cy2IljeX81qADLtCeDl38WVeOss0l99LnbGemKlhaaUDxARXwBj2NNDU1pdxzTYO1_fCrhRdDzF4CLxzHDgVFBk4LWYshN7xd14j8ZKPHHSjaYtm-hfnWwCJrWOys8dtfiuxHI9wRcOn1G5Yc-06Kgaf2sXh1ONQRn8Gi57GNTYjEZqUZM20qKGqA1iReXcx5URcmAoJeM8t6cNdJDxPOGoLCtEz1UZ4sibo-w", "refresh_token": "eyJzdWIiOiJ0ZXN0LWV4dGxpbmstMTc3NzIxNjkwOTIyNiIsImVtYWlsIjoiZXh0bGluaysxNzc3MjE2OTA5MjI2QGV4YW1wbGUuY29tIiwiZmlyc3RfbmFtZSI6IkpvaG4iLCJsYXN0X25hbWUiOiJEb2UifQ"}}}	2026-05-03 15:23:28
76kIAbye_FrhysaXeDHkp98Q4K2zvT1F	{"cookie": {"path": "/", "secure": true, "expires": "2026-05-11T14:47:31.478Z", "httpOnly": true, "originalMaxAge": 604800000}, "passport": {"user": {"claims": {"aud": "165625f1-68ce-4c7b-af24-240466ac94ad", "exp": 1777909651, "iat": 1777906051, "iss": "https://test-mock-oidc.replit.app/", "jti": "773848fc46a1aa0b7540a6637cf43880", "sub": "test-das-delete-1777906021093", "email": "rtrebecca@yahoo.com", "auth_time": 1777906051, "last_name": "Tester", "first_name": "Test"}, "expires_at": 1777909651, "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6Ijc4MDgyZTlmZjVhOTA1YjIifQ.eyJpc3MiOiJodHRwczovL3Rlc3QtbW9jay1vaWRjLnJlcGxpdC5hcHAvIiwiaWF0IjoxNzc3OTA2MDUxLCJleHAiOjE3Nzc5MDk2NTEsInN1YiI6InRlc3QtZGFzLWRlbGV0ZS0xNzc3OTA2MDIxMDkzIiwiZW1haWwiOiJydHJlYmVjY2FAeWFob28uY29tIiwiZmlyc3RfbmFtZSI6IlRlc3QiLCJsYXN0X25hbWUiOiJUZXN0ZXIifQ.wqrFugsaOL2lKfFZvyV9JlrYwMcwEN4hNiuSjY6SCMuP4_C7cPNDomumsBNXDGt4ajfX6L5qmxnQW0WYKWkbLwE7W29ppbYvzs83ZfqvNqw042MJdFa25KPml_kDlpe8Bb1n5C9TZmkuQEn0ECulxNqMNgWc4LWochfTjAuywmn8JYohM6qw_e5eiIOSrTxMyWMUP-FEltXJq1LrzVMPadtZC5UUC7g6Qjl8zPDeEOg5MBgc4ro3KXYwqdWnUPsxBVsW2bJ0fr8aH2LzLEWHWcvlTcHFS9Lr5bM_C0zIaJLhs-72f6kaS-EtsLCcJs8TfIVC1kvKLhL68-top28WEA", "refresh_token": "eyJzdWIiOiJ0ZXN0LWRhcy1kZWxldGUtMTc3NzkwNjAyMTA5MyIsImVtYWlsIjoicnRyZWJlY2NhQHlhaG9vLmNvbSIsImZpcnN0X25hbWUiOiJUZXN0IiwibGFzdF9uYW1lIjoiVGVzdGVyIn0"}}}	2026-05-11 14:48:57
\.


--
-- Data for Name: shipping_profiles; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.shipping_profiles (id, user_id, name, carrier, service_level, base_rate, rate_per_kg, free_shipping_threshold, estimated_days_min, estimated_days_max, regions, is_active, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: sku_mappings; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.sku_mappings (id, user_id, ebay_sku, vendor_id, vendor_sku, vendor_product_url, vendor_name, cost_price, price_threshold, is_active, created_at, ebay_title, ebay_price) FROM stdin;
\.


--
-- Data for Name: stores; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.stores (id, user_id, name, platform, credentials, status, last_sync, created_at, auto_restock, auto_pause_listings, auto_mark_out_of_stock, auto_switch_supplier, restock_threshold) FROM stdin;
8	test-user-001	Test eBay Store	ebay	{"ebayUsername": "testuser123", "refreshToken": "fake-refresh-token"}	active	2026-07-02 16:40:51.833	2026-05-04 15:05:08.54525	f	f	f	f	1
\.


--
-- Data for Name: subscriptions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.subscriptions (id, user_id, stripe_subscription_id, plan_name, status, current_period_end, created_at) FROM stdin;
\.


--
-- Data for Name: suggestions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.suggestions (id, user_id, user_email, user_name, category, subject, message, status, created_at, image_urls) FROM stdin;
\.


--
-- Data for Name: supplier_replacement_log; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.supplier_replacement_log (id, product_id, old_vendor_id, new_vendor_id, old_vendor_name, new_vendor_name, product_title, product_sku, reason, triggered_by, created_at) FROM stdin;
\.


--
-- Data for Name: transactions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.transactions (id, wallet_id, type, amount, description, reference_id, status, created_at, withdraw_method, admin_note, processed_at) FROM stdin;
\.


--
-- Data for Name: trending_products; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.trending_products (id, platform, title, category, price, currency, sales_volume, rank, image_url, product_url, month_year, created_at, vendor_name, vendor_rating, vendor_reviews, vendor_reliability, link_verified_at) FROM stdin;
7663	Amazon	CeraVe Moisturising Cream 454g	Health & Beauty	14.40	GBP	55391	1	\N	https://www.amazon.co.uk/s?k=CeraVe%20Moisturising%20Cream%20454g&ref=nb_sb_noss	2026-W27	2026-06-27 09:35:59.739712	TechDirect UK	4.7	194001	excellent	2026-06-27 09:35:59.737
7664	Amazon	The Ordinary Niacinamide 10% + Zinc 1% 30ml	Health & Beauty	5.80	GBP	57072	2	\N	https://www.amazon.co.uk/s?k=The%20Ordinary%20Niacinamide%2010%25%20%2B%20Zinc%201%25%2030ml&ref=nb_sb_noss	2026-W27	2026-06-27 09:35:59.739712	GadgetHub Pro	4.7	100956	excellent	2026-06-27 09:35:59.737
7665	Amazon	Amazon Basics AA Rechargeable Batteries 8-Pack	Electronics	10.99	GBP	52974	3	\N	https://www.amazon.co.uk/s?k=Amazon%20Basics%20AA%20Rechargeable%20Batteries%208-Pack&ref=nb_sb_noss	2026-W27	2026-06-27 09:35:59.739712	TechDirect UK	4.7	191812	excellent	2026-06-27 09:35:59.737
7666	Amazon	Anker USB-C to Lightning Cable 2-Pack 1.8m	Electronics	13.99	GBP	44439	4	\N	https://www.amazon.co.uk/s?k=Anker%20USB-C%20to%20Lightning%20Cable%202-Pack%201.8m&ref=nb_sb_noss	2026-W27	2026-06-27 09:35:59.739712	HomeEssentials Ltd	4.6	136205	very_good	2026-06-27 09:35:59.737
7667	Amazon	Fire TV Stick Lite with Alexa Voice Remote	Electronics	29.99	GBP	54696	5	\N	https://www.amazon.co.uk/s?k=Fire%20TV%20Stick%20Lite%20with%20Alexa%20Voice%20Remote&ref=nb_sb_noss	2026-W27	2026-06-27 09:35:59.739712	PrimeChoice Store	4.5	80661	very_good	2026-06-27 09:35:59.737
7668	Amazon	Echo Dot 5th Gen Smart Speaker	Smart Home	24.99	GBP	46106	6	\N	https://www.amazon.co.uk/s?k=Echo%20Dot%205th%20Gen%20Smart%20Speaker&ref=nb_sb_noss	2026-W27	2026-06-27 09:35:59.739712	GadgetHub Pro	4.7	100137	excellent	2026-06-27 09:35:59.737
7669	Amazon	COSRX Snail Mucin 96% Essence 100ml	Health & Beauty	12.99	GBP	39897	7	\N	https://www.amazon.co.uk/s?k=COSRX%20Snail%20Mucin%2096%25%20Essence%20100ml&ref=nb_sb_noss	2026-W27	2026-06-27 09:35:59.739712	TechDirect UK	4.7	191993	excellent	2026-06-27 09:35:59.737
7670	Amazon	Duracell Plus AA Alkaline Batteries 12-Pack	Electronics	7.99	GBP	49950	8	\N	https://www.amazon.co.uk/s?k=Duracell%20Plus%20AA%20Alkaline%20Batteries%2012-Pack&ref=nb_sb_noss	2026-W27	2026-06-27 09:35:59.739712	TechDirect UK	4.7	192567	excellent	2026-06-27 09:35:59.737
7671	Amazon	JBL Go 3 Portable Bluetooth Speaker	Electronics	29.99	GBP	46869	9	\N	https://www.amazon.co.uk/s?k=JBL%20Go%203%20Portable%20Bluetooth%20Speaker&ref=nb_sb_noss	2026-W27	2026-06-27 09:35:59.739712	GadgetHub Pro	4.7	103668	excellent	2026-06-27 09:35:59.737
7672	Amazon	TP-Link Tapo Smart Plug Wi-Fi 4-Pack	Smart Home	24.99	GBP	45093	10	\N	https://www.amazon.co.uk/s?k=TP-Link%20Tapo%20Smart%20Plug%20Wi-Fi%204-Pack&ref=nb_sb_noss	2026-W27	2026-06-27 09:35:59.739712	TechDirect UK	4.7	193723	excellent	2026-06-27 09:35:59.737
7673	Amazon	Crocs Classic Clog Unisex Adults	Fashion	34.99	GBP	37059	11	\N	https://www.amazon.co.uk/s?k=Crocs%20Classic%20Clog%20Unisex%20Adults&ref=nb_sb_noss	2026-W27	2026-06-27 09:35:59.739712	TechDirect UK	4.7	192468	excellent	2026-06-27 09:35:59.737
7674	Amazon	Stanley Quencher H2.0 FlowState Tumbler 40oz	Home & Kitchen	35.00	GBP	37751	12	\N	https://www.amazon.co.uk/s?k=Stanley%20Quencher%20H2.0%20FlowState%20Tumbler%2040oz&ref=nb_sb_noss	2026-W27	2026-06-27 09:35:59.739712	TechDirect UK	4.7	191088	excellent	2026-06-27 09:35:59.737
7675	Amazon	Maybelline Lash Sensational Sky High Mascara	Health & Beauty	9.99	GBP	37780	13	\N	https://www.amazon.co.uk/s?k=Maybelline%20Lash%20Sensational%20Sky%20High%20Mascara&ref=nb_sb_noss	2026-W27	2026-06-27 09:35:59.739712	PrimeChoice Store	4.5	78357	very_good	2026-06-27 09:35:59.737
7676	Amazon	LEGO Classic Medium Creative Brick Box 10696	Toys & Games	19.99	GBP	32240	14	\N	https://www.amazon.co.uk/s?k=LEGO%20Classic%20Medium%20Creative%20Brick%20Box%2010696&ref=nb_sb_noss	2026-W27	2026-06-27 09:35:59.739712	PrimeChoice Store	4.5	80251	very_good	2026-06-27 09:35:59.737
7677	Amazon	Instant Pot Duo 7-in-1 Electric Pressure Cooker 5.7L	Home & Kitchen	49.99	GBP	34801	15	\N	https://www.amazon.co.uk/s?k=Instant%20Pot%20Duo%207-in-1%20Electric%20Pressure%20Cooker%205.7L&ref=nb_sb_noss	2026-W27	2026-06-27 09:35:59.739712	TechDirect UK	4.7	189658	excellent	2026-06-27 09:35:59.737
7678	Amazon	Anker PowerCore 10000mAh Portable Charger	Electronics	19.99	GBP	33687	16	\N	https://www.amazon.co.uk/s?k=Anker%20PowerCore%2010000mAh%20Portable%20Charger&ref=nb_sb_noss	2026-W27	2026-06-27 09:35:59.739712	PrimeChoice Store	4.5	79833	very_good	2026-06-27 09:35:59.737
7679	Amazon	Oral-B Vitality Pro Electric Toothbrush	Health & Beauty	24.99	GBP	28540	17	\N	https://www.amazon.co.uk/s?k=Oral-B%20Vitality%20Pro%20Electric%20Toothbrush&ref=nb_sb_noss	2026-W27	2026-06-27 09:35:59.739712	TechDirect UK	4.7	192840	excellent	2026-06-27 09:35:59.737
7680	Amazon	Ring Indoor Camera 2nd Gen	Smart Home	34.99	GBP	30667	18	\N	https://www.amazon.co.uk/s?k=Ring%20Indoor%20Camera%202nd%20Gen&ref=nb_sb_noss	2026-W27	2026-06-27 09:35:59.739712	TechDirect UK	4.7	191346	excellent	2026-06-27 09:35:59.737
7681	Amazon	Tower T17021 Family Size Air Fryer 4.3L	Home & Kitchen	44.99	GBP	27546	19	\N	https://www.amazon.co.uk/s?k=Tower%20T17021%20Family%20Size%20Air%20Fryer%204.3L&ref=nb_sb_noss	2026-W27	2026-06-27 09:35:59.739712	HomeEssentials Ltd	4.6	138782	very_good	2026-06-27 09:35:59.737
7682	Amazon	Nescafé Dolce Gusto Genio S Touch Coffee Machine	Home & Kitchen	49.99	GBP	28197	20	\N	https://www.amazon.co.uk/s?k=Nescaf%C3%A9%20Dolce%20Gusto%20Genio%20S%20Touch%20Coffee%20Machine&ref=nb_sb_noss	2026-W27	2026-06-27 09:35:59.739712	HomeEssentials Ltd	4.6	137260	very_good	2026-06-27 09:35:59.737
7683	Amazon	Google Nest Mini 2nd Gen Smart Speaker	Smart Home	29.00	GBP	26510	21	\N	https://www.amazon.co.uk/s?k=Google%20Nest%20Mini%202nd%20Gen%20Smart%20Speaker&ref=nb_sb_noss	2026-W27	2026-06-27 09:35:59.739712	PrimeChoice Store	4.5	77978	very_good	2026-06-27 09:35:59.737
7684	Amazon	Logitech K380 Multi-Device Bluetooth Keyboard	Electronics	34.99	GBP	28213	22	\N	https://www.amazon.co.uk/s?k=Logitech%20K380%20Multi-Device%20Bluetooth%20Keyboard&ref=nb_sb_noss	2026-W27	2026-06-27 09:35:59.739712	GadgetHub Pro	4.7	99870	excellent	2026-06-27 09:35:59.737
7685	Amazon	Hydro Flask Wide Mouth 32oz Water Bottle	Sports & Outdoors	32.95	GBP	24381	23	\N	https://www.amazon.co.uk/s?k=Hydro%20Flask%20Wide%20Mouth%2032oz%20Water%20Bottle&ref=nb_sb_noss	2026-W27	2026-06-27 09:35:59.739712	PrimeChoice Store	4.5	79839	very_good	2026-06-27 09:35:59.737
7686	Amazon	Yankee Candle Large Jar Vanilla Cupcake	Home & Kitchen	19.99	GBP	27052	24	\N	https://www.amazon.co.uk/s?k=Yankee%20Candle%20Large%20Jar%20Vanilla%20Cupcake&ref=nb_sb_noss	2026-W27	2026-06-27 09:35:59.739712	HomeEssentials Ltd	4.6	136260	very_good	2026-06-27 09:35:59.737
7687	Amazon	PlayStation DualSense Wireless Controller	Gaming	44.99	GBP	23717	25	\N	https://www.amazon.co.uk/s?k=PlayStation%20DualSense%20Wireless%20Controller&ref=nb_sb_noss	2026-W27	2026-06-27 09:35:59.739712	TechDirect UK	4.7	193772	excellent	2026-06-27 09:35:59.737
7688	Amazon	Philips OneBlade Face + Body QP2630	Health & Beauty	34.99	GBP	23553	26	\N	https://www.amazon.co.uk/s?k=Philips%20OneBlade%20Face%20%2B%20Body%20QP2630&ref=nb_sb_noss	2026-W27	2026-06-27 09:35:59.739712	GadgetHub Pro	4.7	102432	excellent	2026-06-27 09:35:59.737
7689	Amazon	BASEUS 20W USB-C Charger 2-Pack	Electronics	9.99	GBP	23687	27	\N	https://www.amazon.co.uk/s?k=BASEUS%2020W%20USB-C%20Charger%202-Pack&ref=nb_sb_noss	2026-W27	2026-06-27 09:35:59.739712	GadgetHub Pro	4.7	100955	excellent	2026-06-27 09:35:59.737
7690	Amazon	Silentnight Airmax Breathable Pillow	Home & Kitchen	12.00	GBP	18956	28	\N	https://www.amazon.co.uk/s?k=Silentnight%20Airmax%20Breathable%20Pillow&ref=nb_sb_noss	2026-W27	2026-06-27 09:35:59.739712	HomeEssentials Ltd	4.6	137909	very_good	2026-06-27 09:35:59.737
7691	Amazon	Fairy Platinum Plus All-in-One Dishwasher Tabs 60pk	Home & Kitchen	14.99	GBP	18191	29	\N	https://www.amazon.co.uk/s?k=Fairy%20Platinum%20Plus%20All-in-One%20Dishwasher%20Tabs%2060pk&ref=nb_sb_noss	2026-W27	2026-06-27 09:35:59.739712	PrimeChoice Store	4.5	77033	very_good	2026-06-27 09:35:59.737
7692	Amazon	Samsung EVO Plus 128GB MicroSD Card	Electronics	11.99	GBP	19038	30	\N	https://www.amazon.co.uk/s?k=Samsung%20EVO%20Plus%20128GB%20MicroSD%20Card&ref=nb_sb_noss	2026-W27	2026-06-27 09:35:59.739712	PrimeChoice Store	4.5	77930	very_good	2026-06-27 09:35:59.737
7693	Amazon	Nivea Soft Moisturising Cream 200ml	Health & Beauty	3.50	GBP	16906	31	\N	https://www.amazon.co.uk/s?k=Nivea%20Soft%20Moisturising%20Cream%20200ml&ref=nb_sb_noss	2026-W27	2026-06-27 09:35:59.739712	PrimeChoice Store	4.5	81241	very_good	2026-06-27 09:35:59.737
7694	Amazon	Logitech M185 Wireless Mouse	Electronics	9.99	GBP	20421	32	\N	https://www.amazon.co.uk/s?k=Logitech%20M185%20Wireless%20Mouse&ref=nb_sb_noss	2026-W27	2026-06-27 09:35:59.739712	HomeEssentials Ltd	4.6	137756	very_good	2026-06-27 09:35:59.737
7695	Amazon	Squishmallows 12" Plush Soft Toy	Toys & Games	14.99	GBP	17429	33	\N	https://www.amazon.co.uk/s?k=Squishmallows%2012%22%20Plush%20Soft%20Toy&ref=nb_sb_noss	2026-W27	2026-06-27 09:35:59.739712	Amazon UK	4.8	2453058	excellent	2026-06-27 09:35:59.737
7696	Amazon	Neutrogena Hydro Boost Water Gel Moisturiser	Health & Beauty	11.99	GBP	18009	34	\N	https://www.amazon.co.uk/s?k=Neutrogena%20Hydro%20Boost%20Water%20Gel%20Moisturiser&ref=nb_sb_noss	2026-W27	2026-06-27 09:35:59.739712	HomeEssentials Ltd	4.6	138117	very_good	2026-06-27 09:35:59.737
7697	Amazon	Nespresso Vertuo Pop Coffee Machine	Home & Kitchen	49.00	GBP	16057	35	\N	https://www.amazon.co.uk/s?k=Nespresso%20Vertuo%20Pop%20Coffee%20Machine&ref=nb_sb_noss	2026-W27	2026-06-27 09:35:59.739712	HomeEssentials Ltd	4.6	134732	very_good	2026-06-27 09:35:59.737
7698	Amazon	Amazon Basics HDMI Cable 2m 4K	Electronics	6.99	GBP	17029	36	\N	https://www.amazon.co.uk/s?k=Amazon%20Basics%20HDMI%20Cable%202m%204K&ref=nb_sb_noss	2026-W27	2026-06-27 09:35:59.739712	GadgetHub Pro	4.7	100200	excellent	2026-06-27 09:35:59.737
7699	Amazon	Pukka Organic Tea Selection Box 45 Bags	Food & Drink	8.99	GBP	16233	37	\N	https://www.amazon.co.uk/s?k=Pukka%20Organic%20Tea%20Selection%20Box%2045%20Bags&ref=nb_sb_noss	2026-W27	2026-06-27 09:35:59.739712	HomeEssentials Ltd	4.6	135323	very_good	2026-06-27 09:35:59.737
7700	Amazon	Bosch IXO 7th Gen Cordless Screwdriver	Home & Garden	39.99	GBP	14222	38	\N	https://www.amazon.co.uk/s?k=Bosch%20IXO%207th%20Gen%20Cordless%20Screwdriver&ref=nb_sb_noss	2026-W27	2026-06-27 09:35:59.739712	Amazon UK	4.8	2454260	excellent	2026-06-27 09:35:59.737
7701	Amazon	Kindle 11th Gen 16GB 6" Display	Electronics	49.99	GBP	15511	39	\N	https://www.amazon.co.uk/s?k=Kindle%2011th%20Gen%2016GB%206%22%20Display&ref=nb_sb_noss	2026-W27	2026-06-27 09:35:59.739712	GadgetHub Pro	4.7	99124	excellent	2026-06-27 09:35:59.737
7702	Amazon	Olaplex No.3 Hair Perfector Treatment 100ml	Health & Beauty	22.00	GBP	13725	40	\N	https://www.amazon.co.uk/s?k=Olaplex%20No.3%20Hair%20Perfector%20Treatment%20100ml&ref=nb_sb_noss	2026-W27	2026-06-27 09:35:59.739712	HomeEssentials Ltd	4.6	135284	very_good	2026-06-27 09:35:59.737
7703	Amazon	Cosori Air Fryer 3.8L	Home & Kitchen	49.99	GBP	11847	41	\N	https://www.amazon.co.uk/s?k=Cosori%20Air%20Fryer%203.8L&ref=nb_sb_noss	2026-W27	2026-06-27 09:35:59.739712	TechDirect UK	4.7	193105	excellent	2026-06-27 09:35:59.737
7704	Amazon	Fitbit Inspire 3 Fitness Tracker	Electronics	49.99	GBP	14328	42	\N	https://www.amazon.co.uk/s?k=Fitbit%20Inspire%203%20Fitness%20Tracker&ref=nb_sb_noss	2026-W27	2026-06-27 09:35:59.739712	GadgetHub Pro	4.7	99690	excellent	2026-06-27 09:35:59.737
7705	Amazon	Gorilla Grip Original Shower Mat	Home & Kitchen	12.99	GBP	12398	43	\N	https://www.amazon.co.uk/s?k=Gorilla%20Grip%20Original%20Shower%20Mat&ref=nb_sb_noss	2026-W27	2026-06-27 09:35:59.739712	Amazon UK	4.8	2454129	excellent	2026-06-27 09:35:59.737
7706	Amazon	Braun Series 3 ProSkin Electric Shaver	Health & Beauty	44.99	GBP	11646	44	\N	https://www.amazon.co.uk/s?k=Braun%20Series%203%20ProSkin%20Electric%20Shaver&ref=nb_sb_noss	2026-W27	2026-06-27 09:35:59.739712	HomeEssentials Ltd	4.6	136842	very_good	2026-06-27 09:35:59.737
7707	Amazon	Govee LED Strip Lights 5m RGB	Smart Home	12.99	GBP	12011	45	\N	https://www.amazon.co.uk/s?k=Govee%20LED%20Strip%20Lights%205m%20RGB&ref=nb_sb_noss	2026-W27	2026-06-27 09:35:59.739712	GadgetHub Pro	4.7	98931	excellent	2026-06-27 09:35:59.737
7708	Amazon	Brita Maxtra Pro Water Filter Cartridges 6-Pack	Home & Kitchen	24.99	GBP	11593	46	\N	https://www.amazon.co.uk/s?k=Brita%20Maxtra%20Pro%20Water%20Filter%20Cartridges%206-Pack&ref=nb_sb_noss	2026-W27	2026-06-27 09:35:59.739712	Amazon UK	4.8	2454035	excellent	2026-06-27 09:35:59.737
7709	Amazon	Energizer Max AAA Batteries 24-Pack	Electronics	9.99	GBP	9785	47	\N	https://www.amazon.co.uk/s?k=Energizer%20Max%20AAA%20Batteries%2024-Pack&ref=nb_sb_noss	2026-W27	2026-06-27 09:35:59.739712	TechDirect UK	4.7	194395	excellent	2026-06-27 09:35:59.737
7710	Amazon	L'Oréal Paris Elvive Dream Lengths Shampoo 400ml	Health & Beauty	4.50	GBP	10494	48	\N	https://www.amazon.co.uk/s?k=L'Or%C3%A9al%20Paris%20Elvive%20Dream%20Lengths%20Shampoo%20400ml&ref=nb_sb_noss	2026-W27	2026-06-27 09:35:59.739712	GadgetHub Pro	4.7	101958	excellent	2026-06-27 09:35:59.737
7711	Amazon	Amazon Basics USB-C to USB-A Cable 2-Pack	Electronics	7.49	GBP	10064	49	\N	https://www.amazon.co.uk/s?k=Amazon%20Basics%20USB-C%20to%20USB-A%20Cable%202-Pack&ref=nb_sb_noss	2026-W27	2026-06-27 09:35:59.739712	PrimeChoice Store	4.5	80883	very_good	2026-06-27 09:35:59.737
7712	Amazon	Moleskine Classic Notebook A5 Hardcover	Stationery	14.99	GBP	9028	50	\N	https://www.amazon.co.uk/s?k=Moleskine%20Classic%20Notebook%20A5%20Hardcover&ref=nb_sb_noss	2026-W27	2026-06-27 09:35:59.739712	TechDirect UK	4.7	190219	excellent	2026-06-27 09:35:59.737
7713	eBay	Nike Air Force 1 '07 Triple White Men's Trainers	Fashion	44.99	GBP	48308	1	\N	https://www.ebay.co.uk/sch/i.html?_nkw=Nike%20Air%20Force%201%20'07%20Triple%20White%20Men's%20Trainers&_sop=12&LH_BIN=1	2026-W27	2026-06-27 09:35:59.739712	tech-direct-outlet	4.9	345496	excellent	2026-06-27 09:35:59.737
7714	eBay	Samsung Galaxy Buds FE Wireless Earbuds	Electronics	39.99	GBP	36727	2	\N	https://www.ebay.co.uk/sch/i.html?_nkw=Samsung%20Galaxy%20Buds%20FE%20Wireless%20Earbuds&_sop=12&LH_BIN=1	2026-W27	2026-06-27 09:35:59.739712	bestbuy-electronics	4.6	139203	very_good	2026-06-27 09:35:59.737
7715	eBay	Pokémon TCG Booster Packs Bundle x10	Collectibles	29.99	GBP	35948	3	\N	https://www.ebay.co.uk/sch/i.html?_nkw=Pok%C3%A9mon%20TCG%20Booster%20Packs%20Bundle%20x10&_sop=12&LH_BIN=1	2026-W27	2026-06-27 09:35:59.739712	bestbuy-electronics	4.6	136731	very_good	2026-06-27 09:35:59.737
7716	eBay	Adidas Samba OG Trainers White Gum	Fashion	49.99	GBP	32057	4	\N	https://www.ebay.co.uk/sch/i.html?_nkw=Adidas%20Samba%20OG%20Trainers%20White%20Gum&_sop=12&LH_BIN=1	2026-W27	2026-06-27 09:35:59.739712	gadgets_warehouse_uk	4.8	270876	excellent	2026-06-27 09:35:59.737
7717	eBay	Apple AirPods 3rd Generation with Case	Electronics	49.99	GBP	33081	5	\N	https://www.ebay.co.uk/sch/i.html?_nkw=Apple%20AirPods%203rd%20Generation%20with%20Case&_sop=12&LH_BIN=1	2026-W27	2026-06-27 09:35:59.739712	tech-direct-outlet	4.9	343162	excellent	2026-06-27 09:35:59.737
7718	eBay	Stanley 1.18L Quencher H2.0 Tumbler	Home & Kitchen	29.99	GBP	30017	6	\N	https://www.ebay.co.uk/sch/i.html?_nkw=Stanley%201.18L%20Quencher%20H2.0%20Tumbler&_sop=12&LH_BIN=1	2026-W27	2026-06-27 09:35:59.739712	fashion-hub-official	4.7	202308	very_good	2026-06-27 09:35:59.737
7719	eBay	Crocs Classic Clog Unisex All Colours	Fashion	24.99	GBP	29371	7	\N	https://www.ebay.co.uk/sch/i.html?_nkw=Crocs%20Classic%20Clog%20Unisex%20All%20Colours&_sop=12&LH_BIN=1	2026-W27	2026-06-27 09:35:59.739712	bestbuy-electronics	4.6	136556	very_good	2026-06-27 09:35:59.737
7720	eBay	New Balance 327 Trainers	Fashion	44.99	GBP	33019	8	\N	https://www.ebay.co.uk/sch/i.html?_nkw=New%20Balance%20327%20Trainers&_sop=12&LH_BIN=1	2026-W27	2026-06-27 09:35:59.739712	gadgets_warehouse_uk	4.8	269613	excellent	2026-06-27 09:35:59.737
7721	eBay	Pandora Moments Snake Chain Bracelet Silver	Jewellery & Watches	39.00	GBP	32355	9	\N	https://www.ebay.co.uk/sch/i.html?_nkw=Pandora%20Moments%20Snake%20Chain%20Bracelet%20Silver&_sop=12&LH_BIN=1	2026-W27	2026-06-27 09:35:59.739712	bestbuy-electronics	4.6	136294	very_good	2026-06-27 09:35:59.737
7722	eBay	PS5 DualSense Wireless Controller	Gaming	39.99	GBP	29195	10	\N	https://www.ebay.co.uk/sch/i.html?_nkw=PS5%20DualSense%20Wireless%20Controller&_sop=12&LH_BIN=1	2026-W27	2026-06-27 09:35:59.739712	bestbuy-electronics	4.6	138502	very_good	2026-06-27 09:35:59.737
7723	eBay	Casio F-91W Classic Digital Watch	Jewellery & Watches	12.99	GBP	28872	11	\N	https://www.ebay.co.uk/sch/i.html?_nkw=Casio%20F-91W%20Classic%20Digital%20Watch&_sop=12&LH_BIN=1	2026-W27	2026-06-27 09:35:59.739712	premium_deals_uk	4.8	157245	excellent	2026-06-27 09:35:59.737
7724	eBay	Dr Martens 1461 Smooth Leather Shoes Black	Fashion	49.99	GBP	24814	12	\N	https://www.ebay.co.uk/sch/i.html?_nkw=Dr%20Martens%201461%20Smooth%20Leather%20Shoes%20Black&_sop=12&LH_BIN=1	2026-W27	2026-06-27 09:35:59.739712	fashion-hub-official	4.7	202591	very_good	2026-06-27 09:35:59.737
7725	eBay	JBL Clip 4 Portable Bluetooth Speaker	Electronics	34.99	GBP	27394	13	\N	https://www.ebay.co.uk/sch/i.html?_nkw=JBL%20Clip%204%20Portable%20Bluetooth%20Speaker&_sop=12&LH_BIN=1	2026-W27	2026-06-27 09:35:59.739712	fashion-hub-official	4.7	201745	very_good	2026-06-27 09:35:59.737
7726	eBay	Vans Old Skool Classic Trainers	Fashion	34.99	GBP	22289	14	\N	https://www.ebay.co.uk/sch/i.html?_nkw=Vans%20Old%20Skool%20Classic%20Trainers&_sop=12&LH_BIN=1	2026-W27	2026-06-27 09:35:59.739712	premium_deals_uk	4.8	160103	excellent	2026-06-27 09:35:59.737
7727	eBay	Nintendo Switch Joy-Con Controllers Pair	Gaming	49.99	GBP	23292	15	\N	https://www.ebay.co.uk/sch/i.html?_nkw=Nintendo%20Switch%20Joy-Con%20Controllers%20Pair&_sop=12&LH_BIN=1	2026-W27	2026-06-27 09:35:59.739712	bestbuy-electronics	4.6	138823	very_good	2026-06-27 09:35:59.737
7728	eBay	Samsung EVO Plus 256GB MicroSD Card	Electronics	18.99	GBP	23363	16	\N	https://www.ebay.co.uk/sch/i.html?_nkw=Samsung%20EVO%20Plus%20256GB%20MicroSD%20Card&_sop=12&LH_BIN=1	2026-W27	2026-06-27 09:35:59.739712	tech-direct-outlet	4.9	345364	excellent	2026-06-27 09:35:59.737
7729	eBay	Converse Chuck Taylor All Star Low White	Fashion	29.99	GBP	19816	17	\N	https://www.ebay.co.uk/sch/i.html?_nkw=Converse%20Chuck%20Taylor%20All%20Star%20Low%20White&_sop=12&LH_BIN=1	2026-W27	2026-06-27 09:35:59.739712	fashion-hub-official	4.7	199817	very_good	2026-06-27 09:35:59.737
7730	eBay	Anker Soundcore Life Q30 Headphones	Electronics	44.99	GBP	17695	18	\N	https://www.ebay.co.uk/sch/i.html?_nkw=Anker%20Soundcore%20Life%20Q30%20Headphones&_sop=12&LH_BIN=1	2026-W27	2026-06-27 09:35:59.739712	tech-direct-outlet	4.9	343295	excellent	2026-06-27 09:35:59.737
7731	eBay	Puma RS-X Trainers	Fashion	39.99	GBP	16685	19	\N	https://www.ebay.co.uk/sch/i.html?_nkw=Puma%20RS-X%20Trainers&_sop=12&LH_BIN=1	2026-W27	2026-06-27 09:35:59.739712	premium_deals_uk	4.8	160827	excellent	2026-06-27 09:35:59.737
7732	eBay	GHD Original Hair Straightener	Health & Beauty	49.99	GBP	20244	20	\N	https://www.ebay.co.uk/sch/i.html?_nkw=GHD%20Original%20Hair%20Straightener&_sop=12&LH_BIN=1	2026-W27	2026-06-27 09:35:59.739712	premium_deals_uk	4.8	157448	excellent	2026-06-27 09:35:59.737
7733	eBay	Reebok Classic Leather Trainers White	Fashion	34.99	GBP	18944	21	\N	https://www.ebay.co.uk/sch/i.html?_nkw=Reebok%20Classic%20Leather%20Trainers%20White&_sop=12&LH_BIN=1	2026-W27	2026-06-27 09:35:59.739712	bestbuy-electronics	4.6	135282	very_good	2026-06-27 09:35:59.737
7734	eBay	Beats Flex Wireless Bluetooth Earphones	Electronics	39.99	GBP	18587	22	\N	https://www.ebay.co.uk/sch/i.html?_nkw=Beats%20Flex%20Wireless%20Bluetooth%20Earphones&_sop=12&LH_BIN=1	2026-W27	2026-06-27 09:35:59.739712	tech-direct-outlet	4.9	346639	excellent	2026-06-27 09:35:59.737
7735	eBay	Ray-Ban New Wayfarer Sunglasses	Fashion	49.99	GBP	14561	23	\N	https://www.ebay.co.uk/sch/i.html?_nkw=Ray-Ban%20New%20Wayfarer%20Sunglasses&_sop=12&LH_BIN=1	2026-W27	2026-06-27 09:35:59.739712	tech-direct-outlet	4.9	346494	excellent	2026-06-27 09:35:59.737
7736	eBay	Titleist Pro V1 Golf Balls Dozen	Sports & Outdoors	42.99	GBP	16260	24	\N	https://www.ebay.co.uk/sch/i.html?_nkw=Titleist%20Pro%20V1%20Golf%20Balls%20Dozen&_sop=12&LH_BIN=1	2026-W27	2026-06-27 09:35:59.739712	premium_deals_uk	4.8	161162	excellent	2026-06-27 09:35:59.737
7737	eBay	Tommy Hilfiger Logo T-Shirt Men's	Fashion	24.99	GBP	15138	25	\N	https://www.ebay.co.uk/sch/i.html?_nkw=Tommy%20Hilfiger%20Logo%20T-Shirt%20Men's&_sop=12&LH_BIN=1	2026-W27	2026-06-27 09:35:59.739712	gadgets_warehouse_uk	4.8	268728	excellent	2026-06-27 09:35:59.737
7738	eBay	Swatch New Gent Watch	Jewellery & Watches	44.99	GBP	12450	26	\N	https://www.ebay.co.uk/sch/i.html?_nkw=Swatch%20New%20Gent%20Watch&_sop=12&LH_BIN=1	2026-W27	2026-06-27 09:35:59.739712	premium_deals_uk	4.8	156690	excellent	2026-06-27 09:35:59.737
7739	eBay	Osprey Daylite 13L Backpack	Travel	35.00	GBP	14133	27	\N	https://www.ebay.co.uk/sch/i.html?_nkw=Osprey%20Daylite%2013L%20Backpack&_sop=12&LH_BIN=1	2026-W27	2026-06-27 09:35:59.739712	bestbuy-electronics	4.6	137185	very_good	2026-06-27 09:35:59.737
7740	eBay	Under Armour Tech 2.0 T-Shirt Men's	Fashion	19.99	GBP	15044	28	\N	https://www.ebay.co.uk/sch/i.html?_nkw=Under%20Armour%20Tech%202.0%20T-Shirt%20Men's&_sop=12&LH_BIN=1	2026-W27	2026-06-27 09:35:59.739712	bestbuy-electronics	4.6	138557	very_good	2026-06-27 09:35:59.737
7741	eBay	Herschel Supply Pop Quiz Backpack	Travel	44.99	GBP	14269	29	\N	https://www.ebay.co.uk/sch/i.html?_nkw=Herschel%20Supply%20Pop%20Quiz%20Backpack&_sop=12&LH_BIN=1	2026-W27	2026-06-27 09:35:59.739712	premium_deals_uk	4.8	157288	excellent	2026-06-27 09:35:59.737
7742	eBay	Havaianas Brasil Logo Flip Flops	Fashion	14.99	GBP	13266	30	\N	https://www.ebay.co.uk/sch/i.html?_nkw=Havaianas%20Brasil%20Logo%20Flip%20Flops&_sop=12&LH_BIN=1	2026-W27	2026-06-27 09:35:59.739712	fashion-hub-official	4.7	198753	very_good	2026-06-27 09:35:59.737
7743	eBay	Calvin Klein Eternity EDT 100ml	Health & Beauty	29.99	GBP	10864	31	\N	https://www.ebay.co.uk/sch/i.html?_nkw=Calvin%20Klein%20Eternity%20EDT%20100ml&_sop=12&LH_BIN=1	2026-W27	2026-06-27 09:35:59.739712	bestbuy-electronics	4.6	135745	very_good	2026-06-27 09:35:59.737
7744	eBay	LEGO Speed Champions 2 Fast 2 Furious Skyline	Toys & Games	19.99	GBP	10617	32	\N	https://www.ebay.co.uk/sch/i.html?_nkw=LEGO%20Speed%20Champions%202%20Fast%202%20Furious%20Skyline&_sop=12&LH_BIN=1	2026-W27	2026-06-27 09:35:59.739712	fashion-hub-official	4.7	201953	very_good	2026-06-27 09:35:59.737
7745	eBay	Karrimor Mount Low Walking Shoes	Fashion	29.99	GBP	9329	33	\N	https://www.ebay.co.uk/sch/i.html?_nkw=Karrimor%20Mount%20Low%20Walking%20Shoes&_sop=12&LH_BIN=1	2026-W27	2026-06-27 09:35:59.739712	tech-direct-outlet	4.9	345524	excellent	2026-06-27 09:35:59.737
7746	eBay	Superdry Vintage Logo T-Shirt	Fashion	19.99	GBP	11223	34	\N	https://www.ebay.co.uk/sch/i.html?_nkw=Superdry%20Vintage%20Logo%20T-Shirt&_sop=12&LH_BIN=1	2026-W27	2026-06-27 09:35:59.739712	fashion-hub-official	4.7	199607	very_good	2026-06-27 09:35:59.737
7747	eBay	Amazon Fire TV Stick 4K	Electronics	34.99	GBP	11199	35	\N	https://www.ebay.co.uk/sch/i.html?_nkw=Amazon%20Fire%20TV%20Stick%204K&_sop=12&LH_BIN=1	2026-W27	2026-06-27 09:35:59.739712	fashion-hub-official	4.7	201579	very_good	2026-06-27 09:35:59.737
7748	eBay	Brabantia 30L Pedal Bin Matt Steel	Home & Kitchen	44.99	GBP	9386	36	\N	https://www.ebay.co.uk/sch/i.html?_nkw=Brabantia%2030L%20Pedal%20Bin%20Matt%20Steel&_sop=12&LH_BIN=1	2026-W27	2026-06-27 09:35:59.739712	bestbuy-electronics	4.6	136185	very_good	2026-06-27 09:35:59.737
7749	eBay	Sony WF-C500 True Wireless Earbuds	Electronics	39.99	GBP	9585	37	\N	https://www.ebay.co.uk/sch/i.html?_nkw=Sony%20WF-C500%20True%20Wireless%20Earbuds&_sop=12&LH_BIN=1	2026-W27	2026-06-27 09:35:59.739712	tech-direct-outlet	4.9	345567	excellent	2026-06-27 09:35:59.737
7750	eBay	Levi's 501 Original Fit Jeans Men's	Fashion	49.99	GBP	8801	38	\N	https://www.ebay.co.uk/sch/i.html?_nkw=Levi's%20501%20Original%20Fit%20Jeans%20Men's&_sop=12&LH_BIN=1	2026-W27	2026-06-27 09:35:59.739712	gadgets_warehouse_uk	4.8	270770	excellent	2026-06-27 09:35:59.737
7751	eBay	Canon PIXMA TS3350 Wireless Printer	Electronics	34.99	GBP	7759	39	\N	https://www.ebay.co.uk/sch/i.html?_nkw=Canon%20PIXMA%20TS3350%20Wireless%20Printer&_sop=12&LH_BIN=1	2026-W27	2026-06-27 09:35:59.739712	gadgets_warehouse_uk	4.8	268127	excellent	2026-06-27 09:35:59.737
7752	eBay	Yankee Candle Large Jar Clean Cotton	Home & Kitchen	16.99	GBP	7686	40	\N	https://www.ebay.co.uk/sch/i.html?_nkw=Yankee%20Candle%20Large%20Jar%20Clean%20Cotton&_sop=12&LH_BIN=1	2026-W27	2026-06-27 09:35:59.739712	gadgets_warehouse_uk	4.8	268065	excellent	2026-06-27 09:35:59.737
7753	eBay	Asics Gel-Contend 8 Running Shoes	Fashion	39.99	GBP	7962	41	\N	https://www.ebay.co.uk/sch/i.html?_nkw=Asics%20Gel-Contend%208%20Running%20Shoes&_sop=12&LH_BIN=1	2026-W27	2026-06-27 09:35:59.739712	bestbuy-electronics	4.6	136071	very_good	2026-06-27 09:35:59.737
7754	eBay	L'Oréal Paris True Match Foundation	Health & Beauty	9.99	GBP	6325	42	\N	https://www.ebay.co.uk/sch/i.html?_nkw=L'Or%C3%A9al%20Paris%20True%20Match%20Foundation&_sop=12&LH_BIN=1	2026-W27	2026-06-27 09:35:59.739712	tech-direct-outlet	4.9	344005	excellent	2026-06-27 09:35:59.737
7755	eBay	Seagate Portable 2TB External Hard Drive	Electronics	44.99	GBP	7564	43	\N	https://www.ebay.co.uk/sch/i.html?_nkw=Seagate%20Portable%202TB%20External%20Hard%20Drive&_sop=12&LH_BIN=1	2026-W27	2026-06-27 09:35:59.739712	tech-direct-outlet	4.9	343388	excellent	2026-06-27 09:35:59.737
7756	eBay	Jack & Jones Originals T-Shirt 3-Pack	Fashion	24.99	GBP	7180	44	\N	https://www.ebay.co.uk/sch/i.html?_nkw=Jack%20%26%20Jones%20Originals%20T-Shirt%203-Pack&_sop=12&LH_BIN=1	2026-W27	2026-06-27 09:35:59.739712	premium_deals_uk	4.8	160199	excellent	2026-06-27 09:35:59.737
7757	eBay	Bodum Chambord French Press 1L	Home & Kitchen	24.99	GBP	5742	45	\N	https://www.ebay.co.uk/sch/i.html?_nkw=Bodum%20Chambord%20French%20Press%201L&_sop=12&LH_BIN=1	2026-W27	2026-06-27 09:35:59.739712	premium_deals_uk	4.8	159476	excellent	2026-06-27 09:35:59.737
7758	eBay	TP-Link TL-SG108 8-Port Gigabit Switch	Electronics	18.99	GBP	5974	46	\N	https://www.ebay.co.uk/sch/i.html?_nkw=TP-Link%20TL-SG108%208-Port%20Gigabit%20Switch&_sop=12&LH_BIN=1	2026-W27	2026-06-27 09:35:59.739712	fashion-hub-official	4.7	198750	very_good	2026-06-27 09:35:59.737
7759	eBay	Lacoste Polo Shirt Classic Fit	Fashion	44.99	GBP	4421	47	\N	https://www.ebay.co.uk/sch/i.html?_nkw=Lacoste%20Polo%20Shirt%20Classic%20Fit&_sop=12&LH_BIN=1	2026-W27	2026-06-27 09:35:59.739712	fashion-hub-official	4.7	200973	very_good	2026-06-27 09:35:59.737
7760	eBay	Philips Hue White E27 Smart Bulb 2-Pack	Smart Home	19.99	GBP	4575	48	\N	https://www.ebay.co.uk/sch/i.html?_nkw=Philips%20Hue%20White%20E27%20Smart%20Bulb%202-Pack&_sop=12&LH_BIN=1	2026-W27	2026-06-27 09:35:59.739712	bestbuy-electronics	4.6	138557	very_good	2026-06-27 09:35:59.737
7761	eBay	Fjällräven Kånken Mini Backpack	Fashion	44.99	GBP	3866	49	\N	https://www.ebay.co.uk/sch/i.html?_nkw=Fj%C3%A4llr%C3%A4ven%20K%C3%A5nken%20Mini%20Backpack&_sop=12&LH_BIN=1	2026-W27	2026-06-27 09:35:59.739712	bestbuy-electronics	4.6	135722	very_good	2026-06-27 09:35:59.737
7762	eBay	SanDisk Ultra 64GB USB 3.0 Flash Drive	Electronics	7.99	GBP	3784	50	\N	https://www.ebay.co.uk/sch/i.html?_nkw=SanDisk%20Ultra%2064GB%20USB%203.0%20Flash%20Drive&_sop=12&LH_BIN=1	2026-W27	2026-06-27 09:35:59.739712	gadgets_warehouse_uk	4.8	269544	excellent	2026-06-27 09:35:59.737
7763	Shopify	The Ordinary Niacinamide 10% + Zinc 1%	Health & Beauty	5.80	GBP	44556	1	\N	https://www.google.co.uk/search?q=The%20Ordinary%20Niacinamide%2010%25%20%2B%20Zinc%201%25+official+store+buy	2026-W27	2026-06-27 09:35:59.739712	Verified Merchant	4.6	31326	very_good	2026-06-27 09:35:59.737
7764	Shopify	Parade Universal High Rise Thong	Fashion	9.00	GBP	42484	2	\N	https://www.google.co.uk/search?q=Parade%20Universal%20High%20Rise%20Thong+official+store+buy	2026-W27	2026-06-27 09:35:59.739712	Direct Brand Site	4.7	43012	excellent	2026-06-27 09:35:59.737
7765	Shopify	Native Deodorant Coconut & Vanilla	Health & Beauty	13.97	GBP	41845	3	\N	https://www.google.co.uk/search?q=Native%20Deodorant%20Coconut%20%26%20Vanilla+official+store+buy	2026-W27	2026-06-27 09:35:59.739712	Direct Brand Site	4.7	42675	excellent	2026-06-27 09:35:59.737
7766	Shopify	Glossier Boy Brow Eyebrow Gel	Health & Beauty	18.00	GBP	43001	4	\N	https://www.google.co.uk/search?q=Glossier%20Boy%20Brow%20Eyebrow%20Gel+official+store+buy	2026-W27	2026-06-27 09:35:59.739712	Verified Merchant	4.6	32763	very_good	2026-06-27 09:35:59.737
7767	Shopify	Gymshark Vital Seamless 2.0 Leggings	Fashion	28.00	GBP	34230	5	\N	https://www.google.co.uk/search?q=Gymshark%20Vital%20Seamless%202.0%20Leggings+official+store+buy	2026-W27	2026-06-27 09:35:59.739712	Verified Merchant	4.6	29331	very_good	2026-06-27 09:35:59.737
7768	Shopify	Olaplex No.3 Hair Perfector Treatment	Health & Beauty	22.00	GBP	30516	6	\N	https://www.google.co.uk/search?q=Olaplex%20No.3%20Hair%20Perfector%20Treatment+official+store+buy	2026-W27	2026-06-27 09:35:59.739712	Official Brand Store	4.8	49481	excellent	2026-06-27 09:35:59.737
7769	Shopify	Huel Daily Greens Powder 30 Servings	Health & Beauty	26.00	GBP	31738	7	\N	https://www.google.co.uk/search?q=Huel%20Daily%20Greens%20Powder%2030%20Servings+official+store+buy	2026-W27	2026-06-27 09:35:59.739712	Direct Brand Site	4.7	39737	excellent	2026-06-27 09:35:59.737
7770	Shopify	True Classic Crew Neck T-Shirt 3-Pack	Fashion	39.99	GBP	25230	8	\N	https://www.google.co.uk/search?q=True%20Classic%20Crew%20Neck%20T-Shirt%203-Pack+official+store+buy	2026-W27	2026-06-27 09:35:59.739712	Direct Brand Site	4.7	39958	excellent	2026-06-27 09:35:59.737
7771	Shopify	Charlotte Tilbury Pillow Talk Lipstick	Health & Beauty	27.00	GBP	27682	9	\N	https://www.google.co.uk/search?q=Charlotte%20Tilbury%20Pillow%20Talk%20Lipstick+official+store+buy	2026-W27	2026-06-27 09:35:59.739712	Direct Brand Site	4.7	39496	excellent	2026-06-27 09:35:59.737
7772	Shopify	Myprotein Impact Whey Protein 1kg	Health & Beauty	18.99	GBP	24197	10	\N	https://www.google.co.uk/search?q=Myprotein%20Impact%20Whey%20Protein%201kg+official+store+buy	2026-W27	2026-06-27 09:35:59.739712	Direct Brand Site	4.7	40295	excellent	2026-06-27 09:35:59.737
7773	Shopify	Beardbrand Utility Oil Tree Ranger 30ml	Health & Beauty	25.00	GBP	26796	11	\N	https://www.google.co.uk/search?q=Beardbrand%20Utility%20Oil%20Tree%20Ranger%2030ml+official+store+buy	2026-W27	2026-06-27 09:35:59.739712	Direct Brand Site	4.7	40521	excellent	2026-06-27 09:35:59.737
7774	Shopify	Frank Green Ceramic Reusable Cup 295ml	Home & Kitchen	29.95	GBP	21313	12	\N	https://www.google.co.uk/search?q=Frank%20Green%20Ceramic%20Reusable%20Cup%20295ml+official+store+buy	2026-W27	2026-06-27 09:35:59.739712	Official Brand Store	4.8	50010	excellent	2026-06-27 09:35:59.737
7775	Shopify	Hydro Flask Standard Mouth 21oz	Sports & Outdoors	29.95	GBP	25847	13	\N	https://www.google.co.uk/search?q=Hydro%20Flask%20Standard%20Mouth%2021oz+official+store+buy	2026-W27	2026-06-27 09:35:59.739712	Direct Brand Site	4.7	39075	excellent	2026-06-27 09:35:59.737
7776	Shopify	MATE. The Label Organic Crew Tee	Fashion	28.00	GBP	23667	14	\N	https://www.google.co.uk/search?q=MATE.%20The%20Label%20Organic%20Crew%20Tee+official+store+buy	2026-W27	2026-06-27 09:35:59.739712	Direct Brand Site	4.7	39150	excellent	2026-06-27 09:35:59.737
7777	Shopify	Bombas Ankle Socks 3-Pack	Fashion	32.80	GBP	21048	15	\N	https://www.google.co.uk/search?q=Bombas%20Ankle%20Socks%203-Pack+official+store+buy	2026-W27	2026-06-27 09:35:59.739712	Verified Merchant	4.6	29145	very_good	2026-06-27 09:35:59.737
7778	Shopify	Richer Poorer Classic Ankle Socks 3-Pack	Fashion	22.00	GBP	18200	16	\N	https://www.google.co.uk/search?q=Richer%20Poorer%20Classic%20Ankle%20Socks%203-Pack+official+store+buy	2026-W27	2026-06-27 09:35:59.739712	Direct Brand Site	4.7	41599	excellent	2026-06-27 09:35:59.737
7779	Shopify	Marine Layer Relaxed Crew Neck T-Shirt	Fashion	32.00	GBP	19901	17	\N	https://www.google.co.uk/search?q=Marine%20Layer%20Relaxed%20Crew%20Neck%20T-Shirt+official+store+buy	2026-W27	2026-06-27 09:35:59.739712	Direct Brand Site	4.7	42677	excellent	2026-06-27 09:35:59.737
7780	Shopify	Olipop Vintage Cola 12-Pack	Food & Drink	29.88	GBP	18826	18	\N	https://www.google.co.uk/search?q=Olipop%20Vintage%20Cola%2012-Pack+official+store+buy	2026-W27	2026-06-27 09:35:59.739712	Direct Brand Site	4.7	41086	excellent	2026-06-27 09:35:59.737
7781	Shopify	Quince Mongolian Cashmere Crewneck Sweater	Fashion	50.00	GBP	15930	19	\N	https://www.google.co.uk/search?q=Quince%20Mongolian%20Cashmere%20Crewneck%20Sweater+official+store+buy	2026-W27	2026-06-27 09:35:59.739712	Direct Brand Site	4.7	42149	excellent	2026-06-27 09:35:59.737
7782	Shopify	Vuori Kore Short 7"	Fashion	48.00	GBP	17016	20	\N	https://www.google.co.uk/search?q=Vuori%20Kore%20Short%207%22+official+store+buy	2026-W27	2026-06-27 09:35:59.739712	Verified Merchant	4.6	31408	very_good	2026-06-27 09:35:59.737
7783	Shopify	Cariuma IBI Low Knit Sneakers	Fashion	49.00	GBP	13436	21	\N	https://www.google.co.uk/search?q=Cariuma%20IBI%20Low%20Knit%20Sneakers+official+store+buy	2026-W27	2026-06-27 09:35:59.739712	Official Brand Store	4.8	46539	excellent	2026-06-27 09:35:59.737
7784	Shopify	Kylie Cosmetics Lip Kit Matte Liquid	Health & Beauty	29.00	GBP	11849	22	\N	https://www.google.co.uk/search?q=Kylie%20Cosmetics%20Lip%20Kit%20Matte%20Liquid+official+store+buy	2026-W27	2026-06-27 09:35:59.739712	Direct Brand Site	4.7	41201	excellent	2026-06-27 09:35:59.737
7785	Shopify	Huel Black Edition Protein Powder 1kg	Health & Beauty	22.50	GBP	14502	23	\N	https://www.google.co.uk/search?q=Huel%20Black%20Edition%20Protein%20Powder%201kg+official+store+buy	2026-W27	2026-06-27 09:35:59.739712	Official Brand Store	4.8	48798	excellent	2026-06-27 09:35:59.737
7786	Shopify	Mejuri Bold Chain Necklace Gold Vermeil	Jewellery & Watches	48.00	GBP	11287	24	\N	https://www.google.co.uk/search?q=Mejuri%20Bold%20Chain%20Necklace%20Gold%20Vermeil+official+store+buy	2026-W27	2026-06-27 09:35:59.739712	Direct Brand Site	4.7	39459	excellent	2026-06-27 09:35:59.737
7787	Shopify	Brooklinen Classic Core Sheet Set	Home & Kitchen	49.00	GBP	10990	25	\N	https://www.google.co.uk/search?q=Brooklinen%20Classic%20Core%20Sheet%20Set+official+store+buy	2026-W27	2026-06-27 09:35:59.739712	Official Brand Store	4.8	47719	excellent	2026-06-27 09:35:59.737
7788	Shopify	Ridge Wallet Aluminium Card Holder	Accessories	45.00	GBP	10409	26	\N	https://www.google.co.uk/search?q=Ridge%20Wallet%20Aluminium%20Card%20Holder+official+store+buy	2026-W27	2026-06-27 09:35:59.739712	Official Brand Store	4.8	49789	excellent	2026-06-27 09:35:59.737
7789	Shopify	Outdoor Voices Exercise Dress	Fashion	48.00	GBP	9894	27	\N	https://www.google.co.uk/search?q=Outdoor%20Voices%20Exercise%20Dress+official+store+buy	2026-W27	2026-06-27 09:35:59.739712	Direct Brand Site	4.7	41440	excellent	2026-06-27 09:35:59.737
7790	Shopify	Aesop Resurrection Aromatique Hand Wash 500ml	Health & Beauty	27.00	GBP	11402	28	\N	https://www.google.co.uk/search?q=Aesop%20Resurrection%20Aromatique%20Hand%20Wash%20500ml+official+store+buy	2026-W27	2026-06-27 09:35:59.739712	Direct Brand Site	4.7	43108	excellent	2026-06-27 09:35:59.737
7791	Shopify	Allbirds Wool Runners	Fashion	49.00	GBP	8052	29	\N	https://www.google.co.uk/search?q=Allbirds%20Wool%20Runners+official+store+buy	2026-W27	2026-06-27 09:35:59.739712	Official Brand Store	4.8	46976	excellent	2026-06-27 09:35:59.737
7792	Shopify	Warby Parker Felix Sunglasses	Accessories	45.00	GBP	8087	30	\N	https://www.google.co.uk/search?q=Warby%20Parker%20Felix%20Sunglasses+official+store+buy	2026-W27	2026-06-27 09:35:59.739712	Official Brand Store	4.8	48344	excellent	2026-06-27 09:35:59.737
7793	Shopify	MVMT Classic Watch 40mm	Jewellery & Watches	48.00	GBP	8087	31	\N	https://www.google.co.uk/search?q=MVMT%20Classic%20Watch%2040mm+official+store+buy	2026-W27	2026-06-27 09:35:59.739712	Direct Brand Site	4.7	43097	excellent	2026-06-27 09:35:59.737
7794	Shopify	Chubbies The Everywear Shorts 5.5"	Fashion	39.50	GBP	7407	32	\N	https://www.google.co.uk/search?q=Chubbies%20The%20Everywear%20Shorts%205.5%22+official+store+buy	2026-W27	2026-06-27 09:35:59.739712	Verified Merchant	4.6	31650	very_good	2026-06-27 09:35:59.737
7795	Shopify	Glossier Cloud Paint Blush	Health & Beauty	20.00	GBP	7349	33	\N	https://www.google.co.uk/search?q=Glossier%20Cloud%20Paint%20Blush+official+store+buy	2026-W27	2026-06-27 09:35:59.739712	Official Brand Store	4.8	47999	excellent	2026-06-27 09:35:59.737
7796	Shopify	Represent Owners Club T-Shirt	Fashion	45.00	GBP	6605	34	\N	https://www.google.co.uk/search?q=Represent%20Owners%20Club%20T-Shirt+official+store+buy	2026-W27	2026-06-27 09:35:59.739712	Direct Brand Site	4.7	42579	excellent	2026-06-27 09:35:59.737
7797	Shopify	Skims Cotton Jersey T-Shirt	Fashion	38.00	GBP	7162	35	\N	https://www.google.co.uk/search?q=Skims%20Cotton%20Jersey%20T-Shirt+official+store+buy	2026-W27	2026-06-27 09:35:59.739712	Verified Merchant	4.6	28425	very_good	2026-06-27 09:35:59.737
7798	Shopify	Native Body Wash Coconut & Vanilla	Health & Beauty	9.97	GBP	6490	36	\N	https://www.google.co.uk/search?q=Native%20Body%20Wash%20Coconut%20%26%20Vanilla+official+store+buy	2026-W27	2026-06-27 09:35:59.739712	Official Brand Store	4.8	48924	excellent	2026-06-27 09:35:59.737
7799	Shopify	Ruggable Washable Rug Runner 2.5x7 ft	Home & Kitchen	49.00	GBP	5637	37	\N	https://www.google.co.uk/search?q=Ruggable%20Washable%20Rug%20Runner%202.5x7%20ft+official+store+buy	2026-W27	2026-06-27 09:35:59.739712	Official Brand Store	4.8	46379	excellent	2026-06-27 09:35:59.737
7800	Shopify	Caraway Ceramic Fry Pan 10"	Home & Kitchen	45.00	GBP	5281	38	\N	https://www.google.co.uk/search?q=Caraway%20Ceramic%20Fry%20Pan%2010%22+official+store+buy	2026-W27	2026-06-27 09:35:59.739712	Direct Brand Site	4.7	41132	excellent	2026-06-27 09:35:59.737
7801	Shopify	Rothy's The Flat Shoes	Fashion	49.00	GBP	5024	39	\N	https://www.google.co.uk/search?q=Rothy's%20The%20Flat%20Shoes+official+store+buy	2026-W27	2026-06-27 09:35:59.739712	Direct Brand Site	4.7	42872	excellent	2026-06-27 09:35:59.737
7802	Shopify	Fellow Carter Move Travel Mug 12oz	Home & Kitchen	28.00	GBP	5019	40	\N	https://www.google.co.uk/search?q=Fellow%20Carter%20Move%20Travel%20Mug%2012oz+official+store+buy	2026-W27	2026-06-27 09:35:59.739712	Direct Brand Site	4.7	40357	excellent	2026-06-27 09:35:59.737
7803	Shopify	Lululemon Align Tank Top	Fashion	48.00	GBP	3660	41	\N	https://www.google.co.uk/search?q=Lululemon%20Align%20Tank%20Top+official+store+buy	2026-W27	2026-06-27 09:35:59.739712	Official Brand Store	4.8	46706	excellent	2026-06-27 09:35:59.737
7804	Shopify	On Cloud 5 Running Shoes	Fashion	49.99	GBP	3472	42	\N	https://www.google.co.uk/search?q=On%20Cloud%205%20Running%20Shoes+official+store+buy	2026-W27	2026-06-27 09:35:59.739712	Verified Merchant	4.6	30155	very_good	2026-06-27 09:35:59.737
7805	Shopify	Parade Re:Play Bralette	Fashion	22.00	GBP	3342	43	\N	https://www.google.co.uk/search?q=Parade%20Re%3APlay%20Bralette+official+store+buy	2026-W27	2026-06-27 09:35:59.739712	Official Brand Store	4.8	46043	excellent	2026-06-27 09:35:59.737
7806	Shopify	Brooklinen Super-Plush Bath Towels Pair	Home & Kitchen	49.00	GBP	3581	44	\N	https://www.google.co.uk/search?q=Brooklinen%20Super-Plush%20Bath%20Towels%20Pair+official+store+buy	2026-W27	2026-06-27 09:35:59.739712	Direct Brand Site	4.7	41608	excellent	2026-06-27 09:35:59.737
7807	Shopify	Veja Esplar Trainers White	Fashion	45.00	GBP	3342	45	\N	https://www.google.co.uk/search?q=Veja%20Esplar%20Trainers%20White+official+store+buy	2026-W27	2026-06-27 09:35:59.739712	Verified Merchant	4.6	30899	very_good	2026-06-27 09:35:59.737
7808	Shopify	True Classic V-Neck T-Shirt	Fashion	25.00	GBP	2515	46	\N	https://www.google.co.uk/search?q=True%20Classic%20V-Neck%20T-Shirt+official+store+buy	2026-W27	2026-06-27 09:35:59.739712	Official Brand Store	4.8	49875	excellent	2026-06-27 09:35:59.737
7809	Shopify	Glossier Milky Jelly Cleanser	Health & Beauty	20.00	GBP	2432	47	\N	https://www.google.co.uk/search?q=Glossier%20Milky%20Jelly%20Cleanser+official+store+buy	2026-W27	2026-06-27 09:35:59.739712	Official Brand Store	4.8	47719	excellent	2026-06-27 09:35:59.737
7810	Shopify	Bombas Gripper Slipper	Fashion	34.00	GBP	2668	48	\N	https://www.google.co.uk/search?q=Bombas%20Gripper%20Slipper+official+store+buy	2026-W27	2026-06-27 09:35:59.739712	Official Brand Store	4.8	50178	excellent	2026-06-27 09:35:59.737
7811	Shopify	Quince Organic Cotton Hoodie	Fashion	35.00	GBP	1999	49	\N	https://www.google.co.uk/search?q=Quince%20Organic%20Cotton%20Hoodie+official+store+buy	2026-W27	2026-06-27 09:35:59.739712	Direct Brand Site	4.7	42003	excellent	2026-06-27 09:35:59.737
7812	Shopify	Huel Ready-to-Drink Meal 6-Pack	Food & Drink	18.00	GBP	1879	50	\N	https://www.google.co.uk/search?q=Huel%20Ready-to-Drink%20Meal%206-Pack+official+store+buy	2026-W27	2026-06-27 09:35:59.739712	Verified Merchant	4.6	30254	very_good	2026-06-27 09:35:59.737
7813	CJ Dropshipping	Portable Mini Handheld Fan USB Rechargeable	Electronics	5.99	GBP	94822	1	\N	https://www.cjdropshipping.com/list/winning-products.html	2026-W27	2026-06-27 09:35:59.739712	CJ UK Fulfilment	4.7	203027	excellent	2026-06-27 09:35:59.737
7814	CJ Dropshipping	Pet Hair Remover Roller Reusable	Pet Supplies	7.49	GBP	76426	2	\N	https://www.cjdropshipping.com/list/winning-products.html	2026-W27	2026-06-27 09:35:59.739712	CJ UK Fulfilment	4.7	200630	excellent	2026-06-27 09:35:59.737
7815	CJ Dropshipping	LED Strip Lights 5m RGB with Remote	Smart Home	8.99	GBP	63244	3	\N	https://www.cjdropshipping.com/list/winning-products.html	2026-W27	2026-06-27 09:35:59.739712	CJ UK Fulfilment	4.7	199914	excellent	2026-06-27 09:35:59.737
7816	CJ Dropshipping	Magnetic Phone Car Mount 360 Rotation	Accessories	4.99	GBP	55273	4	\N	https://www.cjdropshipping.com/list/winning-products.html	2026-W27	2026-06-27 09:35:59.739712	CJ UK Fulfilment	4.7	200722	excellent	2026-06-27 09:35:59.737
7817	CJ Dropshipping	Silicone Stretch Lids Set of 6	Home & Kitchen	6.49	GBP	64666	5	\N	https://www.cjdropshipping.com/list/winning-products.html	2026-W27	2026-06-27 09:35:59.739712	CJ Trending Hub	4.6	143897	very_good	2026-06-27 09:35:59.737
7818	CJ Dropshipping	Wireless Doorbell with 52 Chimes Waterproof	Smart Home	9.99	GBP	47133	6	\N	https://www.cjdropshipping.com/list/winning-products.html	2026-W27	2026-06-27 09:35:59.739712	CJ UK Fulfilment	4.7	198737	excellent	2026-06-27 09:35:59.737
7819	CJ Dropshipping	Foldable Yoga Mat Non-Slip 6mm	Sports & Outdoors	12.99	GBP	42602	7	\N	https://www.cjdropshipping.com/list/winning-products.html	2026-W27	2026-06-27 09:35:59.739712	CJ Trending Hub	4.6	145809	very_good	2026-06-27 09:35:59.737
7820	CJ Dropshipping	Wireless Earbuds Bluetooth 5.3 with Charging Case	Electronics	11.99	GBP	43597	8	\N	https://www.cjdropshipping.com/list/winning-products.html	2026-W27	2026-06-27 09:35:59.739712	CJ Trending Hub	4.6	145182	very_good	2026-06-27 09:35:59.737
7821	CJ Dropshipping	Reusable Silicone Food Storage Bags Set of 4	Home & Kitchen	8.99	GBP	35509	9	\N	https://www.cjdropshipping.com/list/winning-products.html	2026-W27	2026-06-27 09:35:59.739712	CJ Trending Hub	4.6	143646	very_good	2026-06-27 09:35:59.737
7822	CJ Dropshipping	Smart LED Sunset Projector Lamp	Home Décor	13.99	GBP	34734	10	\N	https://www.cjdropshipping.com/list/winning-products.html	2026-W27	2026-06-27 09:35:59.739712	CJ Official Warehouse	4.8	412342	excellent	2026-06-27 09:35:59.737
7823	CJ Dropshipping	Multifunctional Vegetable Slicer 12-in-1	Home & Kitchen	14.99	GBP	33630	11	\N	https://www.cjdropshipping.com/list/winning-products.html	2026-W27	2026-06-27 09:35:59.739712	CJ UK Fulfilment	4.7	200862	excellent	2026-06-27 09:35:59.737
7824	CJ Dropshipping	Posture Corrector Back Support Brace	Health & Beauty	9.99	GBP	30660	12	\N	https://www.cjdropshipping.com/list/winning-products.html	2026-W27	2026-06-27 09:35:59.739712	CJ Trending Hub	4.6	146127	very_good	2026-06-27 09:35:59.737
7825	CJ Dropshipping	USB Heated Mug Coaster with Auto Shutoff	Home & Kitchen	7.99	GBP	26918	13	\N	https://www.cjdropshipping.com/list/winning-products.html	2026-W27	2026-06-27 09:35:59.739712	CJ Official Warehouse	4.8	417043	excellent	2026-06-27 09:35:59.737
7826	CJ Dropshipping	Portable Mini Sealing Machine for Snack Bags	Home & Kitchen	6.99	GBP	28131	14	\N	https://www.cjdropshipping.com/list/winning-products.html	2026-W27	2026-06-27 09:35:59.739712	CJ UK Fulfilment	4.7	200857	excellent	2026-06-27 09:35:59.737
7827	CJ Dropshipping	Self-Stirring Coffee Mug Electric	Home & Kitchen	8.49	GBP	26474	15	\N	https://www.cjdropshipping.com/list/winning-products.html	2026-W27	2026-06-27 09:35:59.739712	CJ Trending Hub	4.6	147630	very_good	2026-06-27 09:35:59.737
7828	Costco	Kirkland Signature Italian Extra Virgin Olive Oil 2L	Food & Drink	12.99	GBP	89837	1	\N	https://www.costco.co.uk/best-sellers	2026-W27	2026-06-27 09:35:59.739712	Costco UK	4.8	290288	excellent	2026-06-27 09:35:59.737
7829	Costco	Charmin Ultra Soft Toilet Paper 30 Rolls	Household	29.99	GBP	66859	2	\N	https://www.costco.co.uk/best-sellers	2026-W27	2026-06-27 09:35:59.739712	Costco UK	4.8	286990	excellent	2026-06-27 09:35:59.737
7830	Costco	Kirkland Signature Premium Drinking Water 35-Pack	Food & Drink	9.99	GBP	68204	3	\N	https://www.costco.co.uk/best-sellers	2026-W27	2026-06-27 09:35:59.739712	Costco Wholesale Online	4.7	177528	excellent	2026-06-27 09:35:59.737
7831	Costco	Vitamix A2500 Ascent Series Blender	Home & Kitchen	499.99	GBP	38952	4	\N	https://www.costco.co.uk/best-sellers	2026-W27	2026-06-27 09:35:59.739712	Costco UK	4.8	287442	excellent	2026-06-27 09:35:59.737
7832	Costco	Bose QuietComfort 45 Wireless Headphones	Electronics	229.99	GBP	43577	5	\N	https://www.costco.co.uk/best-sellers	2026-W27	2026-06-27 09:35:59.739712	Costco UK	4.8	288993	excellent	2026-06-27 09:35:59.737
7833	Costco	Kirkland Signature Multivitamin Adults 365 Tablets	Health & Beauty	14.99	GBP	32619	6	\N	https://www.costco.co.uk/best-sellers	2026-W27	2026-06-27 09:35:59.739712	Costco UK	4.8	291377	excellent	2026-06-27 09:35:59.737
7834	Costco	iRobot Roomba i7+ Self-Emptying Robot Vacuum	Smart Home	599.99	GBP	30813	7	\N	https://www.costco.co.uk/best-sellers	2026-W27	2026-06-27 09:35:59.739712	Costco UK	4.8	288631	excellent	2026-06-27 09:35:59.737
7835	Costco	Stanley Quencher H2.0 FlowState Tumbler 40oz 4-Pack	Home & Kitchen	89.99	GBP	25153	8	\N	https://www.costco.co.uk/best-sellers	2026-W27	2026-06-27 09:35:59.739712	Costco UK	4.8	290961	excellent	2026-06-27 09:35:59.737
7836	Costco	Kirkland Signature Bath Tissue 2-Ply 30 Rolls	Household	21.99	GBP	23073	9	\N	https://www.costco.co.uk/best-sellers	2026-W27	2026-06-27 09:35:59.739712	Costco UK	4.8	287863	excellent	2026-06-27 09:35:59.737
7837	Costco	Cuisinart 14-Cup Food Processor	Home & Kitchen	199.99	GBP	20528	10	\N	https://www.costco.co.uk/best-sellers	2026-W27	2026-06-27 09:35:59.739712	Costco UK	4.8	286401	excellent	2026-06-27 09:35:59.737
7838	Costco	Tide Pods HE Laundry Detergent 152-Count	Household	29.99	GBP	19910	11	\N	https://www.costco.co.uk/best-sellers	2026-W27	2026-06-27 09:35:59.739712	Costco UK	4.8	286753	excellent	2026-06-27 09:35:59.737
7839	Costco	Apple AirPods Pro 2nd Generation USB-C	Electronics	199.99	GBP	18474	12	\N	https://www.costco.co.uk/best-sellers	2026-W27	2026-06-27 09:35:59.739712	Costco Wholesale Online	4.7	176794	excellent	2026-06-27 09:35:59.737
7840	Costco	Kirkland Signature Toasted Coconut Almonds 1kg	Food & Drink	12.99	GBP	19315	13	\N	https://www.costco.co.uk/best-sellers	2026-W27	2026-06-27 09:35:59.739712	Costco UK	4.8	286426	excellent	2026-06-27 09:35:59.737
7841	Costco	Dyson V11 Animal Cordless Vacuum Cleaner	Home & Kitchen	449.99	GBP	17686	14	\N	https://www.costco.co.uk/best-sellers	2026-W27	2026-06-27 09:35:59.739712	Costco UK	4.8	289380	excellent	2026-06-27 09:35:59.737
7842	Costco	Le Creuset Signature Round Casserole 24cm	Home & Kitchen	229.99	GBP	16277	15	\N	https://www.costco.co.uk/best-sellers	2026-W27	2026-06-27 09:35:59.739712	Costco UK	4.8	288474	excellent	2026-06-27 09:35:59.737
7843	Home Bargains	Tower Air Fryer 4.3L Family Size Black	Home & Kitchen	44.99	GBP	88761	1	\N	https://www.homebargains.co.uk/categories/home-bargains-bestsellers	2026-W27	2026-06-27 09:35:59.739712	Home Bargains Online	4.7	145180	excellent	2026-06-27 09:35:59.737
7844	Home Bargains	Yankee Candle Large Jar Vanilla Cupcake	Home Décor	12.99	GBP	95767	2	\N	https://www.homebargains.co.uk/categories/home-bargains-bestsellers	2026-W27	2026-06-27 09:35:59.739712	Home Bargains Store Direct	4.6	97160	very_good	2026-06-27 09:35:59.737
7845	Home Bargains	Fairy Platinum Plus Dishwasher Tabs 60-Pack	Household	9.99	GBP	84683	3	\N	https://www.homebargains.co.uk/categories/home-bargains-bestsellers	2026-W27	2026-06-27 09:35:59.739712	Home Bargains Online	4.7	146479	excellent	2026-06-27 09:35:59.737
7846	Home Bargains	Lenor Outdoorable Fabric Conditioner 1L	Household	3.99	GBP	78275	4	\N	https://www.homebargains.co.uk/categories/home-bargains-bestsellers	2026-W27	2026-06-27 09:35:59.739712	Home Bargains Store Direct	4.6	100022	very_good	2026-06-27 09:35:59.737
7847	Home Bargains	Cadbury Dairy Milk Chocolate Bar 360g	Food & Drink	3.99	GBP	69580	5	\N	https://www.homebargains.co.uk/categories/home-bargains-bestsellers	2026-W27	2026-06-27 09:35:59.739712	Home Bargains Store Direct	4.6	96912	very_good	2026-06-27 09:35:59.737
7848	Home Bargains	Russell Hobbs Glass Kettle Illuminating	Home & Kitchen	24.99	GBP	57854	6	\N	https://www.homebargains.co.uk/categories/home-bargains-bestsellers	2026-W27	2026-06-27 09:35:59.739712	Home Bargains Store Direct	4.6	98000	very_good	2026-06-27 09:35:59.737
7849	Home Bargains	Salter Stainless Steel Bathroom Scale Digital	Health & Beauty	12.99	GBP	42218	7	\N	https://www.homebargains.co.uk/categories/home-bargains-bestsellers	2026-W27	2026-06-27 09:35:59.739712	Home Bargains Online	4.7	143213	excellent	2026-06-27 09:35:59.737
7850	Home Bargains	Glade Aromatherapy Pure Essential Oils Diffuser	Home Décor	5.99	GBP	45406	8	\N	https://www.homebargains.co.uk/categories/home-bargains-bestsellers	2026-W27	2026-06-27 09:35:59.739712	Home Bargains Online	4.7	146388	excellent	2026-06-27 09:35:59.737
7851	Home Bargains	Pringles Original Crisps 200g 5-Pack	Food & Drink	5.99	GBP	46590	9	\N	https://www.homebargains.co.uk/categories/home-bargains-bestsellers	2026-W27	2026-06-27 09:35:59.739712	Home Bargains Online	4.7	144613	excellent	2026-06-27 09:35:59.737
7852	Home Bargains	Cif All-Purpose Cleaning Wipes 100-Pack	Household	2.99	GBP	37814	10	\N	https://www.homebargains.co.uk/categories/home-bargains-bestsellers	2026-W27	2026-06-27 09:35:59.739712	Home Bargains Store Direct	4.6	98913	very_good	2026-06-27 09:35:59.737
7853	Home Bargains	Beldray 1.5L Cordless Steam Iron	Home & Kitchen	14.99	GBP	31445	11	\N	https://www.homebargains.co.uk/categories/home-bargains-bestsellers	2026-W27	2026-06-27 09:35:59.739712	Home Bargains Online	4.7	144991	excellent	2026-06-27 09:35:59.737
7854	Home Bargains	Garnier Micellar Cleansing Water 700ml	Health & Beauty	4.99	GBP	32415	12	\N	https://www.homebargains.co.uk/categories/home-bargains-bestsellers	2026-W27	2026-06-27 09:35:59.739712	Home Bargains Store Direct	4.6	100495	very_good	2026-06-27 09:35:59.737
7855	Home Bargains	Persil Bio Washing Liquid 85 Wash	Household	12.99	GBP	26404	13	\N	https://www.homebargains.co.uk/categories/home-bargains-bestsellers	2026-W27	2026-06-27 09:35:59.739712	Home Bargains Store Direct	4.6	100937	very_good	2026-06-27 09:35:59.737
7856	Home Bargains	Nescafe Gold Blend Instant Coffee 200g	Food & Drink	6.99	GBP	28097	14	\N	https://www.homebargains.co.uk/categories/home-bargains-bestsellers	2026-W27	2026-06-27 09:35:59.739712	Home Bargains Online	4.7	147440	excellent	2026-06-27 09:35:59.737
7857	Home Bargains	Brabantia Touch Bin 30L Stainless Steel	Home & Kitchen	39.99	GBP	28038	15	\N	https://www.homebargains.co.uk/categories/home-bargains-bestsellers	2026-W27	2026-06-27 09:35:59.739712	Home Bargains Online	4.7	144329	excellent	2026-06-27 09:35:59.737
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (id, email, first_name, last_name, profile_image_url, stripe_customer_id, created_at, updated_at, email_verified, verification_token, verification_token_expiry, policies_accepted, onboarding_completed, payment_skipped, subscription_plan, subscription_status, referral_code, referred_by, api_key, password, unique_url, phone, profile_change_code, profile_change_code_expiry, profile_change_pending, reset_password_token, reset_password_token_expiry, currency, is_admin, stripe_connect_account_id, billing_interval, disclaimer_accepted, auto_restock_enabled, auto_restock_buffer, default_profit_enabled, default_profit_percentage, auto_pause_on_failed_stock, publish_dispute_hold, publish_dispute_hold_at, publish_dispute_stripe_id, role, auto_restock) FROM stdin;
test-user-001	test@test.com	\N	\N	\N	\N	2026-02-16 00:29:01.734089	2026-02-25 22:25:45.853	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	dfk_ea67adb1e76490a035b63957466437f9	$2b$10$5KcLCeJ2Xpj5nUYGeDc02Omxp8TG5gJ3TeCpDIK6j5endKKVdDdbW	testurl123	\N	\N	\N	\N	f7ee3cf8-95f5-45ca-990d-6a9b76d5a028	2026-02-25 23:25:45.853	GBP	false	\N	\N	\N	f	10	f	30	t	f	\N	\N	user	f
test-storerules-1777215393655	storerules+1777215393655@example.com	Store	Tester	\N	\N	2026-04-26 14:56:53.427996	2026-04-26 14:56:53.427996	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	GBP	false	\N	\N	\N	f	10	f	30	t	f	\N	\N	user	f
test-srules-1777215936261	srules+1777215936261@example.com	Store	Tester	\N	\N	2026-04-26 15:05:55.792992	2026-04-26 15:08:33.157	2026-04-26 15:06:17.109768	\N	\N	2026-04-26 15:06:17.109768	2026-04-26 15:06:17.109768	2026-04-26 15:06:17.109768	\N	\N	\N	\N	dfk_4255026c8ac241e69844cad6598bf14a	\N	51c72bd8120f	\N	\N	\N	\N	\N	\N	GBP	false	\N	\N	\N	t	25	t	40	t	f	\N	\N	user	f
test-final-1777218061987	final+1777218061987@example.com	John	Doe	\N	\N	2026-04-26 15:41:24.07275	2026-04-26 15:41:45.743	2026-04-26 15:41:44.503227	\N	\N	2026-04-26 15:41:44.503227	2026-04-26 15:41:44.503227	2026-04-26 15:41:44.503227	\N	\N	\N	\N	dfk_8a2a58e809a84e8a91216bdc6dd820cf	\N	ed75c7962571	\N	\N	\N	\N	\N	\N	GBP	false	\N	\N	\N	f	10	f	30	t	f	\N	\N	user	f
test-extcreds-1777217044521	extcreds+1777217044521@example.com	John	Doe	\N	\N	2026-04-26 15:24:21.734852	2026-04-26 15:24:40.046	2026-04-26 15:24:33.854537	\N	\N	2026-04-26 15:24:33.854537	2026-04-26 15:24:33.854537	2026-04-26 15:24:33.854537	\N	\N	\N	\N	dfk_8933ecf98a854b509f99dc512d72753c	\N	cfe4776c7b88	\N	\N	\N	\N	\N	\N	GBP	false	\N	\N	\N	f	10	f	30	t	f	\N	\N	user	f
test-extok-1777217220294	extok+1777217220294@example.com	John	Doe	\N	\N	2026-04-26 15:27:15.261799	2026-04-26 15:27:44.239	2026-04-26 15:27:38.103347	\N	\N	2026-04-26 15:27:38.103347	2026-04-26 15:27:38.103347	2026-04-26 15:27:38.103347	\N	\N	\N	\N	dfk_a8328a80263d4801a8324ee9cf8e27d5	\N	6939f5edbe28	\N	\N	\N	\N	\N	\N	GBP	false	\N	\N	\N	f	10	f	30	t	f	\N	\N	user	f
test-extsec-1777217529961	extsec+1777217529961@example.com	Test	User	\N	\N	2026-04-26 15:32:27.991639	2026-04-26 15:32:50.88	2026-04-26 15:32:50.118413	\N	\N	2026-04-26 15:32:50.118413	2026-04-26 15:32:50.118413	2026-04-26 15:32:50.118413	\N	\N	\N	\N	dfk_7fd9c104ee864c21b93b148a1ccec521	\N	24c0a01c2344	\N	\N	\N	\N	\N	\N	GBP	false	\N	\N	\N	f	10	f	30	t	f	\N	\N	user	f
test-lister-uid-f84212f	sarah.j@dropandsell.online	Sarah	Johnson	\N	\N	2026-05-04 15:05:48.543441	2026-05-04 15:05:48.543441	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	testpass123	\N	\N	\N	\N	\N	\N	\N	GBP	false	\N	\N	\N	f	10	f	30	t	f	\N	\N	user	f
test-finalsec-1777217837615	finalsec+1777217837615@example.com	Test	User	\N	\N	2026-04-26 15:37:33.792787	2026-04-26 15:38:16.272	2026-04-26 15:37:45.601264	\N	\N	2026-04-26 15:38:10.187	2026-04-26 15:38:16.149	\N	\N	\N	\N	\N	dfk_cb388162933a48e9ab32ade241cf1b6f	\N	49cc7c618eed	\N	\N	\N	\N	\N	\N	GBP	false	\N	\N	2026-04-26 15:38:10.187	f	10	f	30	t	f	\N	\N	user	f
test-toggleoff-1777216241036	toggleoff+1777216241036@example.com	John	Doe	\N	\N	2026-04-26 15:10:55.341855	2026-04-26 15:12:05.816	2026-04-26 15:11:17.366123	\N	\N	2026-04-26 15:11:35.923	2026-04-26 15:11:40.633	\N	\N	\N	\N	\N	dfk_58fd3a2924fa486e8c8920a5393e1b42	\N	aa555466a73d	\N	\N	\N	\N	\N	\N	GBP	false	\N	\N	2026-04-26 15:11:35.923	f	10	f	30	t	f	\N	\N	user	f
test-extlink-1777216909226	extlink+1777216909226@example.com	John	Doe	\N	\N	2026-04-26 15:22:04.102315	2026-04-26 15:22:39.388	2026-04-26 15:22:38.389682	\N	\N	2026-04-26 15:22:38.389682	2026-04-26 15:22:38.389682	2026-04-26 15:22:38.389682	\N	\N	\N	\N	dfk_409a7bac11914a4f90601a3e5cbc1dda	\N	9ed1f003b485	\N	\N	\N	\N	\N	\N	GBP	false	\N	\N	2026-04-26 15:22:38.389682	f	10	f	30	t	f	\N	\N	user	f
test-das-delete-1777906021093	rtrebecca@yahoo.com	Test	Tester	\N	\N	2026-05-04 14:47:31.462898	2026-05-04 14:48:27.737	2026-05-04 14:48:04.296684	\N	\N	2026-05-04 14:48:19.904	2026-05-04 14:48:27.604	\N	\N	\N	\N	\N	dfk_bc8970616b334855a089740066525492	\N	b37e029dde83	\N	\N	\N	\N	\N	\N	GBP	false	\N	\N	2026-05-04 14:48:19.904	f	10	f	30	t	f	\N	\N	user	f
\.


--
-- Data for Name: vendors; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.vendors (id, user_id, name, website, integration_type, config, status, created_at, is_global, verification_status, verified_at, verified_by, contact_person, contact_email, contact_phone, category, tags, country, lead_time, payment_terms, notes, logo, min_order_amount, health_score, average_shipping_days, cancellation_rate, stock_update_reliability, return_rate, late_delivery_rate, total_orders_fulfilled, last_health_check) FROM stdin;
3	test-user-001	Amazon	https://www.amazon.co.uk	custom	{"source": "extension", "vendorType": "amazon"}	active	2026-02-23 17:19:21.719386	t	verified	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	\N
271	test-user-001	Metro Shoes Direct	https://www.metroshoesdirect.org	csv	{}	active	2026-07-01 17:09:52.245561	t	verified	\N	\N	Anthony Hernandez	anthony.hernandez@metroshoesdirect.com	+86 500 3866	wholesale	bulk-discount, MOQ-high, wholesale-only, factory-direct, MOQ-low, eco-friendly	Indonesia	10-15 days	PayPal	Bulk orders only. MOQ applies.	\N	\N	\N	\N	\N	\N	\N	\N	0	\N
362	test-user-001	Apex Toys & Hobbies Corp.	https://www.apextoyshobbiescorp.net	csv	{}	active	2026-07-01 17:09:52.275955	t	verified	\N	\N	Melissa Tanaka	melissa.tanaka@apextoyshobbiescorp.com	+33 700 2697	other	sample-available, white-label, sample-available, free-samples, wholesale-only	Brazil	14-21 days	Net 45	Specialty supplier. Flexible terms.	\N	50.00	\N	\N	\N	\N	\N	\N	0	\N
4	test-user-001	Titan Pet Supplies International	https://www.titanpetsuppliesinte.com	csv	{}	active	2026-07-01 17:09:52.087135	t	verified	\N	\N	Hiroshi Zhang	hiroshi.zhang@titanpetsuppliesinternational.com	+44 300 3729	dropshipper	dropship-ready, fast-shipping, global-shipping, MOQ-low, sample-available, MOQ-high	China	7-14 days	Net 15	Worldwide shipping with tracking. Fulfillment within 24h.	\N	500.00	\N	\N	\N	\N	\N	\N	0	\N
5	test-user-001	Titan Home Decor Sourcing	https://www.titanhomedecorsourci.com	csv	{}	active	2026-07-01 17:09:52.087135	t	verified	\N	\N	Stephanie Diaz	stephanie.diaz@titanhomedecorsourcing.com	+91 600 8931	dropshipper	dropship-ready, fast-shipping, global-shipping, MOQ-low, sample-available, bulk-discount	Philippines	1-2 weeks	Wire Transfer	Automated dropshipping. No minimum order.	\N	1000.00	\N	\N	\N	\N	\N	\N	0	\N
6	test-user-001	Universal Camping & Hiking Group	https://www.universalcampinghiki.com	api	{}	active	2026-07-01 17:09:52.087135	t	verified	\N	\N	Ahmed White	ahmed.white@universalcampinghikinggroup.com	+86 600 8587	wholesale	bulk-discount, MOQ-high, wholesale-only, factory-direct, white-label, global-shipping	India	7-10 days	Wire Transfer	Factory-direct pricing. Samples available.	\N	\N	\N	\N	\N	\N	\N	\N	0	\N
7	test-user-001	Elite Watches Holdings	https://www.elitewatchesholdings.com	custom	{}	active	2026-07-01 17:09:52.087135	t	verified	\N	\N	Yuki Li	yuki.li@elitewatchesholdings.com	+86 500 7696	manufacturer	private-label, custom-packaging, certified, wholesale-only, eco-friendly, verified-supplier	Canada	2-3 weeks	Net 90	In-house design team. Custom packaging available.	\N	200.00	\N	\N	\N	\N	\N	\N	0	\N
8	test-user-001	Pacific Watches Inc.	https://www.pacificwatchesinc.org	feed	{}	active	2026-07-01 17:09:52.087135	t	verified	\N	\N	Amy Thompson	amy.thompson@pacificwatchesinc.com	+86 200 2128	distributor	retail-ready, verified-supplier, certified, private-label, verified-supplier	China	10-15 days	T/T	Multi-brand distributor. Same-day dispatch.	\N	500.00	\N	\N	\N	\N	\N	\N	0	\N
9	test-user-001	Global Eyewear Limited	https://www.globaleyewearlimited.org	feed	{}	active	2026-07-01 17:09:52.087135	t	verified	\N	\N	Lisa Adams	lisa.adams@globaleyewearlimited.com	+91 400 2610	dropshipper	dropship-ready, fast-shipping, global-shipping, MOQ-low, sample-available, retail-ready	Portugal	14-21 days	Net 45	Worldwide shipping with tracking. Fulfillment within 24h.	\N	500.00	\N	\N	\N	\N	\N	\N	0	\N
10	test-user-001	Nova Crafts & Sewing Inc.	https://www.novacraftssewinginc.com	csv	{}	active	2026-07-01 17:09:52.087135	t	verified	\N	\N	Ashley Campbell	ashley.campbell@novacraftssewinginc.com	+33 600 2166	dropshipper	dropship-ready, fast-shipping, global-shipping, MOQ-low, sample-available, certified	UK	1-2 weeks	Credit Card	Worldwide shipping with tracking. Fulfillment within 24h.	\N	\N	\N	\N	\N	\N	\N	\N	0	\N
11	test-user-001	Delta Lighting Enterprise	https://www.deltalightingenterpr.org	api	{}	active	2026-07-01 17:09:52.087135	t	verified	\N	\N	Gary Chen	gary.chen@deltalightingenterprise.com	+33 400 6422	dropshipper	dropship-ready, fast-shipping, global-shipping, MOQ-low, sample-available, eco-friendly	UK	2-3 weeks	Credit Card	Automated dropshipping. No minimum order.	\N	\N	\N	\N	\N	\N	\N	\N	0	\N
12	test-user-001	Summit Bags & Luggage International	https://www.summitbagsluggageint.com	custom	{}	active	2026-07-01 17:09:52.087135	t	verified	\N	\N	Hiroshi Smith	hiroshi.smith@summitbagsluggageinternational.com	+1 400 1349	manufacturer	private-label, custom-packaging, certified, fast-shipping, wholesale-only, custom-packaging	South Korea	7-14 days	PayPal + Net 30	In-house design team. Custom packaging available.	\N	\N	\N	\N	\N	\N	\N	\N	0	\N
13	test-user-001	Vertex Eyewear Limited	https://www.vertexeyewearlimited.org	custom	{}	active	2026-07-01 17:09:52.087135	t	verified	\N	\N	Donald Taylor	donald.taylor@vertexeyewearlimited.com	+81 700 5047	dropshipper	dropship-ready, fast-shipping, global-shipping, MOQ-low, sample-available, bulk-discount	Thailand	7-12 days	Credit Card	Automated dropshipping. No minimum order.	\N	\N	\N	\N	\N	\N	\N	\N	0	\N
14	test-user-001	Universal Bags & Luggage Industries	https://www.universalbagsluggage.org	custom	{}	active	2026-07-01 17:09:52.087135	t	verified	\N	\N	Frank Reyes	frank.reyes@universalbagsluggageindustries.com	+44 200 1891	wholesale	bulk-discount, MOQ-high, wholesale-only, factory-direct, MOQ-low, bulk-discount	Sri Lanka	5-10 days	Western Union	Bulk orders only. MOQ applies.	\N	\N	\N	\N	\N	\N	\N	\N	0	\N
15	test-user-001	Delta Eyewear Sourcing	https://www.deltaeyewearsourcing.com	api	{}	active	2026-07-01 17:09:52.087135	t	verified	\N	\N	Sharon Rivera	sharon.rivera@deltaeyewearsourcing.com	+44 300 9509	dropshipper	dropship-ready, fast-shipping, global-shipping, MOQ-low, sample-available, wholesale-only	Philippines	5-7 days	Net 30	Worldwide shipping with tracking. Fulfillment within 24h.	\N	1000.00	\N	\N	\N	\N	\N	\N	0	\N
16	test-user-001	Delta Watches Trading Co.	https://www.deltawatchestradingc.net	csv	{}	active	2026-07-01 17:09:52.087135	t	verified	\N	\N	Kevin Anderson	kevin.anderson@deltawatchestradingco.com	+44 200 4334	dropshipper	dropship-ready, fast-shipping, global-shipping, MOQ-low, sample-available, certified	Bangladesh	5-10 days	Net 45	Automated dropshipping. No minimum order.	\N	100.00	\N	\N	\N	\N	\N	\N	0	\N
17	test-user-001	Premier Home Decor International	https://www.premierhomedecorinte.com	csv	{}	active	2026-07-01 17:09:52.087135	t	verified	\N	\N	Melissa Thompson	melissa.thompson@premierhomedecorinternational.com	+81 200 7571	distributor	retail-ready, verified-supplier, custom-packaging, MOQ-high, factory-direct	Poland	5-7 days	T/T	Authorized distributor for major brands.	\N	1000.00	\N	\N	\N	\N	\N	\N	0	\N
18	test-user-001	Apex Eyewear Partners	https://www.apexeyewearpartners.org	csv	{}	active	2026-07-01 17:09:52.087135	t	verified	\N	\N	Wei Miller	wei.miller@apexeyewearpartners.com	+1 400 7781	distributor	retail-ready, verified-supplier, global-shipping, certified, sample-available	UK	5-10 days	Letter of Credit	Multi-brand distributor. Same-day dispatch.	\N	50.00	\N	\N	\N	\N	\N	\N	0	\N
19	test-user-001	Atlas Tools & Hardware Company	https://www.atlastoolshardwareco.com	csv	{}	active	2026-07-01 17:09:52.087135	t	verified	\N	\N	Xia Liu	xia.liu@atlastoolshardwarecompany.com	+81 400 2078	other	sample-available, white-label, MOQ-high, private-label, wholesale-only	Bangladesh	15-30 days	Letter of Credit	Curated product selection. Personal account manager.	\N	\N	\N	\N	\N	\N	\N	\N	0	\N
20	test-user-001	Atlas Furniture Inc.	https://www.atlasfurnitureinc.net	feed	{}	active	2026-07-01 17:09:52.087135	t	verified	\N	\N	Dorothy Kim	dorothy.kim@atlasfurnitureinc.com	+49 300 6611	other	sample-available, white-label, MOQ-high, eco-friendly, fast-shipping	UK	7-12 days	Net 15	Curated product selection. Personal account manager.	\N	\N	\N	\N	\N	\N	\N	\N	0	\N
21	test-user-001	Prime Lighting Sourcing	https://www.primelightingsourcin.com	api	{}	active	2026-07-01 17:09:52.087135	t	verified	\N	\N	Fatima Walker	fatima.walker@primelightingsourcing.com	+86 700 5889	other	sample-available, white-label, global-shipping, fast-shipping, quality-assured	Philippines	5-10 days	Net 30	Curated product selection. Personal account manager.	\N	500.00	\N	\N	\N	\N	\N	\N	0	\N
22	test-user-001	Titan Watches Enterprise	https://www.titanwatchesenterpri.org	api	{}	active	2026-07-01 17:09:52.087135	t	verified	\N	\N	Jennifer Robinson	jennifer.robinson@titanwatchesenterprise.com	+81 700 5148	manufacturer	private-label, custom-packaging, certified, eco-friendly, MOQ-low, sample-available	Taiwan	1-2 weeks	Letter of Credit	In-house design team. Custom packaging available.	\N	1000.00	\N	\N	\N	\N	\N	\N	0	\N
23	test-user-001	Vertex Camping & Hiking Corp.	https://www.vertexcampinghikingc.org	feed	{}	active	2026-07-01 17:09:52.087135	t	verified	\N	\N	Wei Martin	wei.martin@vertexcampinghikingcorp.com	+1 700 8894	manufacturer	private-label, custom-packaging, certified, global-shipping, custom-packaging, private-label	Italy	5-7 days	Credit Card	In-house design team. Custom packaging available.	\N	\N	\N	\N	\N	\N	\N	\N	0	\N
24	test-user-001	Alpha Eyewear Direct	https://www.alphaeyeweardirect.org	custom	{}	active	2026-07-01 17:09:52.087135	t	verified	\N	\N	Deborah Park	deborah.park@alphaeyeweardirect.com	+49 500 1134	distributor	retail-ready, verified-supplier, dropship-ready, fast-shipping, factory-direct	Australia	7-14 days	PayPal + Net 30	Multi-brand distributor. Same-day dispatch.	\N	100.00	\N	\N	\N	\N	\N	\N	0	\N
25	test-user-001	Supreme Watches International	https://www.supremewatchesintern.net	custom	{}	active	2026-07-01 17:09:52.087135	t	verified	\N	\N	Richard Flores	richard.flores@supremewatchesinternational.com	+44 700 3106	manufacturer	private-label, custom-packaging, certified, verified-supplier, certified, wholesale-only	Brazil	5-10 days	Net 90	In-house design team. Custom packaging available.	\N	500.00	\N	\N	\N	\N	\N	\N	0	\N
26	test-user-001	Nova Eyewear Trading Co.	https://www.novaeyeweartradingco.net	feed	{}	active	2026-07-01 17:09:52.087135	t	verified	\N	\N	Linda Kim	linda.kim@novaeyeweartradingco.com	+44 400 7857	distributor	retail-ready, verified-supplier, white-label, premium, factory-direct	South Korea	15-30 days	T/T	Authorized distributor for major brands.	\N	50.00	\N	\N	\N	\N	\N	\N	0	\N
27	test-user-001	Elite Furniture Limited	https://www.elitefurniturelimite.org	feed	{}	active	2026-07-01 17:09:52.087135	t	verified	\N	\N	Aiko Li	aiko.li@elitefurniturelimited.com	+81 600 4893	manufacturer	private-label, custom-packaging, certified, fast-shipping, MOQ-high, MOQ-low	Pakistan	10-15 days	Net 30	In-house design team. Custom packaging available.	\N	500.00	\N	\N	\N	\N	\N	\N	0	\N
28	test-user-001	Supreme Bags & Luggage Holdings	https://www.supremebagsluggageho.org	api	{}	active	2026-07-01 17:09:52.087135	t	verified	\N	\N	William Suzuki	william.suzuki@supremebagsluggageholdings.com	+1 400 7620	distributor	retail-ready, verified-supplier, eco-friendly, certified, custom-packaging	Portugal	7-12 days	Wire Transfer	Multi-brand distributor. Same-day dispatch.	\N	100.00	\N	\N	\N	\N	\N	\N	0	\N
29	test-user-001	Alpha Camping & Hiking Limited	https://www.alphacampinghikingli.com	api	{}	active	2026-07-01 17:09:52.087135	t	verified	\N	\N	Nicholas Davis	nicholas.davis@alphacampinghikinglimited.com	+86 500 2928	other	sample-available, white-label, global-shipping, MOQ-low, quality-assured	Spain	7-14 days	Letter of Credit	Specialty supplier. Flexible terms.	\N	1000.00	\N	\N	\N	\N	\N	\N	0	\N
30	test-user-001	Pacific Clothing Partners	https://www.pacificclothingpartn.org	custom	{}	active	2026-07-01 17:09:52.087135	t	verified	\N	\N	Joseph Martinez	joseph.martinez@pacificclothingpartners.com	+33 600 3438	wholesale	bulk-discount, MOQ-high, wholesale-only, factory-direct, organic-certified, MOQ-low	UK	7-14 days	PayPal	Factory-direct pricing. Samples available.	\N	\N	\N	\N	\N	\N	\N	\N	0	\N
31	test-user-001	Titan Eyewear Supplies	https://www.titaneyewearsupplies.net	custom	{}	active	2026-07-01 17:09:52.087135	t	verified	\N	\N	Elizabeth Hall	elizabeth.hall@titaneyewearsupplies.com	+33 600 8028	dropshipper	dropship-ready, fast-shipping, global-shipping, MOQ-low, sample-available, MOQ-low	Taiwan	14-21 days	PayPal + Net 30	Automated dropshipping. No minimum order.	\N	50.00	\N	\N	\N	\N	\N	\N	0	\N
32	test-user-001	Summit Lighting Enterprise	https://www.summitlightingenterp.net	api	{}	active	2026-07-01 17:09:52.087135	t	verified	\N	\N	Christopher Wright	christopher.wright@summitlightingenterprise.com	+86 300 9527	dropshipper	dropship-ready, fast-shipping, global-shipping, MOQ-low, sample-available, private-label	Turkey	3-7 days	Net 15	Worldwide shipping with tracking. Fulfillment within 24h.	\N	500.00	\N	\N	\N	\N	\N	\N	0	\N
33	test-user-001	Delta Camping & Hiking Supplies	https://www.deltacampinghikingsu.net	feed	{}	active	2026-07-01 17:09:52.087135	t	verified	\N	\N	Helen Chen	helen.chen@deltacampinghikingsupplies.com	+91 200 4069	distributor	retail-ready, verified-supplier, custom-packaging, organic-certified, fast-shipping	Spain	14-21 days	Letter of Credit	Authorized distributor for major brands.	\N	\N	\N	\N	\N	\N	\N	\N	0	\N
34	test-user-001	Delta Furniture Group	https://www.deltafurnituregroup.com	feed	{}	active	2026-07-01 17:09:52.087135	t	verified	\N	\N	Isabella Patel	isabella.patel@deltafurnituregroup.com	+49 700 1082	distributor	retail-ready, verified-supplier, private-label, bulk-discount, premium	France	2-3 weeks	PayPal	Multi-brand distributor. Same-day dispatch.	\N	200.00	\N	\N	\N	\N	\N	\N	0	\N
35	test-user-001	Peak Shoes Sourcing	https://www.peakshoessourcing.net	feed	{}	active	2026-07-01 17:09:52.087135	t	verified	\N	\N	Nicholas Walker	nicholas.walker@peakshoessourcing.com	+91 600 8312	distributor	retail-ready, verified-supplier, fast-shipping, bulk-discount, eco-friendly	Turkey	3-5 days	PayPal + Net 30	Multi-brand distributor. Same-day dispatch.	\N	500.00	\N	\N	\N	\N	\N	\N	0	\N
36	test-user-001	Vertex Clothing Trading Co.	https://www.vertexclothingtradin.org	csv	{}	active	2026-07-01 17:09:52.087135	t	verified	\N	\N	Maria Tanaka	maria.tanaka@vertexclothingtradingco.com	+91 600 5169	wholesale	bulk-discount, MOQ-high, wholesale-only, factory-direct, bulk-discount, private-label	Indonesia	3-7 days	Credit Card	Bulk orders only. MOQ applies.	\N	100.00	\N	\N	\N	\N	\N	\N	0	\N
37	test-user-001	Zenith Shoes Inc.	https://www.zenithshoesinc.net	feed	{}	active	2026-07-01 17:09:52.087135	t	verified	\N	\N	Jeffrey Martin	jeffrey.martin@zenithshoesinc.com	+49 300 9214	manufacturer	private-label, custom-packaging, certified, premium, MOQ-low, white-label	Brazil	7-14 days	Letter of Credit	Full OEM/ODM capabilities. ISO certified.	\N	\N	\N	\N	\N	\N	\N	\N	0	\N
38	test-user-001	Omega Shoes Partners	https://www.omegashoespartners.net	feed	{}	active	2026-07-01 17:09:52.087135	t	verified	\N	\N	Brian Walker	brian.walker@omegashoespartners.com	+91 400 4954	other	sample-available, white-label, fast-shipping, sample-available, certified	Australia	7-14 days	T/T	Curated product selection. Personal account manager.	\N	\N	\N	\N	\N	\N	\N	\N	0	\N
39	test-user-001	Metro Watches Solutions	https://www.metrowatchessolution.org	feed	{}	active	2026-07-01 17:09:52.087135	t	verified	\N	\N	Aiko Scott	aiko.scott@metrowatchessolutions.com	+44 400 9862	dropshipper	dropship-ready, fast-shipping, global-shipping, MOQ-low, sample-available, premium	Malaysia	2-3 weeks	Letter of Credit	Worldwide shipping with tracking. Fulfillment within 24h.	\N	50.00	\N	\N	\N	\N	\N	\N	0	\N
40	test-user-001	Premier Bags & Luggage Solutions	https://www.premierbagsluggageso.com	feed	{}	active	2026-07-01 17:09:52.087135	t	verified	\N	\N	Michelle Cruz	michelle.cruz@premierbagsluggagesolutions.com	+86 200 7924	other	sample-available, white-label, sample-available, wholesale-only, free-samples	Netherlands	10-15 days	Net 45	Specialty supplier. Flexible terms.	\N	1000.00	\N	\N	\N	\N	\N	\N	0	\N
41	test-user-001	Pacific Jewelry & Accessories Group	https://www.pacificjewelryaccess.com	api	{}	active	2026-07-01 17:09:52.087135	t	verified	\N	\N	Sandra Choi	sandra.choi@pacificjewelryaccessoriesgroup.com	+44 500 9116	manufacturer	private-label, custom-packaging, certified, MOQ-low, premium, custom-packaging	Brazil	7-10 days	Net 90	Full OEM/ODM capabilities. ISO certified.	\N	200.00	\N	\N	\N	\N	\N	\N	0	\N
42	test-user-001	Omega Stationery Enterprise	https://www.omegastationeryenter.com	csv	{}	active	2026-07-01 17:09:52.087135	t	verified	\N	\N	Jung Parker	jung.parker@omegastationeryenterprise.com	+86 500 1062	manufacturer	private-label, custom-packaging, certified, wholesale-only, MOQ-low, certified	France	5-7 days	Letter of Credit	In-house design team. Custom packaging available.	\N	\N	\N	\N	\N	\N	\N	\N	0	\N
43	test-user-001	Prime Fashion Limited	https://www.primefashionlimited.org	feed	{}	active	2026-07-01 17:09:52.087135	t	verified	\N	\N	Daniel Suzuki	daniel.suzuki@primefashionlimited.com	+33 400 7247	other	sample-available, white-label, bulk-discount, premium, private-label	Bangladesh	15-30 days	Western Union	Specialty supplier. Flexible terms.	\N	1000.00	\N	\N	\N	\N	\N	\N	0	\N
44	test-user-001	Premier Pet Supplies Direct	https://www.premierpetsuppliesdi.org	feed	{}	active	2026-07-01 17:09:52.087135	t	verified	\N	\N	Wei Wang	wei.wang@premierpetsuppliesdirect.com	+81 700 8375	manufacturer	private-label, custom-packaging, certified, custom-packaging, quality-assured, global-shipping	Turkey	1-2 weeks	Credit Card	In-house design team. Custom packaging available.	\N	500.00	\N	\N	\N	\N	\N	\N	0	\N
45	test-user-001	Global Party Supplies Direct	https://www.globalpartysuppliesd.org	feed	{}	active	2026-07-01 17:09:52.087135	t	verified	\N	\N	Sharon Lopez	sharon.lopez@globalpartysuppliesdirect.com	+91 700 9711	other	sample-available, white-label, verified-supplier, MOQ-low, dropship-ready	Vietnam	3-7 days	Wire Transfer	Specialty supplier. Flexible terms.	\N	500.00	\N	\N	\N	\N	\N	\N	0	\N
46	test-user-001	Alpha Home Decor Corp.	https://www.alphahomedecorcorp.org	api	{}	active	2026-07-01 17:09:52.087135	t	verified	\N	\N	Timothy Garcia	timothy.garcia@alphahomedecorcorp.com	+33 200 5654	other	sample-available, white-label, certified, dropship-ready, fast-shipping	France	7-10 days	Net 45	Specialty supplier. Flexible terms.	\N	\N	\N	\N	\N	\N	\N	\N	0	\N
47	test-user-001	Peak Kitchen & Dining Corp.	https://www.peakkitchendiningcor.org	feed	{}	active	2026-07-01 17:09:52.087135	t	verified	\N	\N	Ryan Baker	ryan.baker@peakkitchendiningcorp.com	+1 400 3701	manufacturer	private-label, custom-packaging, certified, free-samples, eco-friendly, global-shipping	Taiwan	7-10 days	Credit Card	In-house design team. Custom packaging available.	\N	50.00	\N	\N	\N	\N	\N	\N	0	\N
48	test-user-001	Metro Electronics Group	https://www.metroelectronicsgrou.net	api	{}	active	2026-07-01 17:09:52.087135	t	verified	\N	\N	Maria Anderson	maria.anderson@metroelectronicsgroup.com	+33 700 4783	dropshipper	dropship-ready, fast-shipping, global-shipping, MOQ-low, sample-available, bulk-discount	Brazil	3-7 days	Net 45	Worldwide shipping with tracking. Fulfillment within 24h.	\N	200.00	\N	\N	\N	\N	\N	\N	0	\N
49	test-user-001	Zenith Automotive Industries	https://www.zenithautomotiveindu.org	api	{}	active	2026-07-01 17:09:52.087135	t	verified	\N	\N	Mia Jones	mia.jones@zenithautomotiveindustries.com	+44 200 6963	dropshipper	dropship-ready, fast-shipping, global-shipping, MOQ-low, sample-available, eco-friendly	Brazil	14-21 days	Credit Card	Worldwide shipping with tracking. Fulfillment within 24h.	\N	\N	\N	\N	\N	\N	\N	\N	0	\N
50	test-user-001	Royal Eyewear International	https://www.royaleyewearinternat.net	csv	{}	active	2026-07-01 17:09:52.087135	t	verified	\N	\N	Laura Hall	laura.hall@royaleyewearinternational.com	+1 200 4783	dropshipper	dropship-ready, fast-shipping, global-shipping, MOQ-low, sample-available, verified-supplier	Australia	3-7 days	Net 45	Automated dropshipping. No minimum order.	\N	50.00	\N	\N	\N	\N	\N	\N	0	\N
51	test-user-001	Atlas Jewelry & Accessories Holdings	https://www.atlasjewelryaccessor.net	csv	{}	active	2026-07-01 17:09:52.087135	t	verified	\N	\N	Dorothy Nelson	dorothy.nelson@atlasjewelryaccessoriesholdings.com	+91 200 3153	manufacturer	private-label, custom-packaging, certified, retail-ready, private-label, verified-supplier	Poland	2-3 weeks	Net 90	Full OEM/ODM capabilities. ISO certified.	\N	50.00	\N	\N	\N	\N	\N	\N	0	\N
52	test-user-001	Apex Shoes Supplies	https://www.apexshoessupplies.net	custom	{}	active	2026-07-01 17:09:52.087135	t	verified	\N	\N	Stephanie Baker	stephanie.baker@apexshoessupplies.com	+86 600 9729	wholesale	bulk-discount, MOQ-high, wholesale-only, factory-direct, MOQ-low, white-label	Malaysia	3-7 days	Credit Card	Factory-direct pricing. Samples available.	\N	\N	\N	\N	\N	\N	\N	\N	0	\N
53	test-user-001	Royal Camping & Hiking Corp.	https://www.royalcampinghikingco.com	api	{}	active	2026-07-01 17:09:52.087135	t	verified	\N	\N	Isabella Nelson	isabella.nelson@royalcampinghikingcorp.com	+49 500 1453	manufacturer	private-label, custom-packaging, certified, global-shipping, fast-shipping, custom-packaging	UK	7-12 days	Western Union	Full OEM/ODM capabilities. ISO certified.	\N	200.00	\N	\N	\N	\N	\N	\N	0	\N
54	test-user-001	Vertex Tools & Hardware Inc.	https://www.vertextoolshardwarei.net	csv	{}	active	2026-07-01 17:09:52.164761	t	verified	\N	\N	Carlos Reyes	carlos.reyes@vertextoolshardwareinc.com	+49 300 1510	wholesale	bulk-discount, MOQ-high, wholesale-only, factory-direct, free-samples, custom-packaging	Canada	5-7 days	Net 45	Bulk orders only. MOQ applies.	\N	\N	\N	\N	\N	\N	\N	\N	0	\N
55	test-user-001	Elite Home & Garden Trading Co.	https://www.elitehomegardentradi.com	custom	{}	active	2026-07-01 17:09:52.164761	t	verified	\N	\N	Robert Yamamoto	robert.yamamoto@elitehomegardentradingco.com	+33 200 7927	dropshipper	dropship-ready, fast-shipping, global-shipping, MOQ-low, sample-available, MOQ-low	USA	3-5 days	Net 30	Automated dropshipping. No minimum order.	\N	\N	\N	\N	\N	\N	\N	\N	0	\N
56	test-user-001	Atlas Baby Products Limited	https://www.atlasbabyproductslim.net	api	{}	active	2026-07-01 17:09:52.164761	t	verified	\N	\N	Margaret Diaz	margaret.diaz@atlasbabyproductslimited.com	+91 400 9478	other	sample-available, white-label, white-label, verified-supplier, private-label	Thailand	14-21 days	Wire Transfer	Curated product selection. Personal account manager.	\N	200.00	\N	\N	\N	\N	\N	\N	0	\N
57	test-user-001	Zenith Clothing Direct	https://www.zenithclothingdirect.com	custom	{}	active	2026-07-01 17:09:52.164761	t	verified	\N	\N	Robert Wang	robert.wang@zenithclothingdirect.com	+91 600 6262	distributor	retail-ready, verified-supplier, white-label, MOQ-low, fast-shipping	Portugal	7-10 days	Credit Card	Multi-brand distributor. Same-day dispatch.	\N	100.00	\N	\N	\N	\N	\N	\N	0	\N
58	test-user-001	Universal Home Decor Holdings	https://www.universalhomedecorho.net	feed	{}	active	2026-07-01 17:09:52.164761	t	verified	\N	\N	Stephanie Adams	stephanie.adams@universalhomedecorholdings.com	+81 500 6948	distributor	retail-ready, verified-supplier, bulk-discount, premium, certified	Canada	2-3 weeks	T/T	Multi-brand distributor. Same-day dispatch.	\N	200.00	\N	\N	\N	\N	\N	\N	0	\N
59	test-user-001	Omega Fashion Supplies	https://www.omegafashionsupplies.net	feed	{}	active	2026-07-01 17:09:52.164761	t	verified	\N	\N	Hiroshi Evans	hiroshi.evans@omegafashionsupplies.com	+33 300 7730	wholesale	bulk-discount, MOQ-high, wholesale-only, factory-direct, free-samples, private-label	Philippines	7-12 days	PayPal + Net 30	Long-standing supplier with consistent quality.	\N	500.00	\N	\N	\N	\N	\N	\N	0	\N
60	test-user-001	Metro Home & Garden Supplies	https://www.metrohomegardensuppl.net	csv	{}	active	2026-07-01 17:09:52.164761	t	verified	\N	\N	David Brown	david.brown@metrohomegardensupplies.com	+86 200 9622	dropshipper	dropship-ready, fast-shipping, global-shipping, MOQ-low, sample-available, MOQ-high	China	14-21 days	Western Union	Automated dropshipping. No minimum order.	\N	1000.00	\N	\N	\N	\N	\N	\N	0	\N
61	test-user-001	Peak Watches Inc.	https://www.peakwatchesinc.com	custom	{}	active	2026-07-01 17:09:52.164761	t	verified	\N	\N	Andrew Robinson	andrew.robinson@peakwatchesinc.com	+33 300 1580	manufacturer	private-label, custom-packaging, certified, retail-ready, verified-supplier, quality-assured	Netherlands	7-12 days	PayPal + Net 30	In-house design team. Custom packaging available.	\N	500.00	\N	\N	\N	\N	\N	\N	0	\N
62	test-user-001	Nova Fashion Direct	https://www.novafashiondirect.com	csv	{}	active	2026-07-01 17:09:52.164761	t	verified	\N	\N	Donna Baker	donna.baker@novafashiondirect.com	+1 600 3788	manufacturer	private-label, custom-packaging, certified, MOQ-low, MOQ-high, white-label	Sri Lanka	7-14 days	Wire Transfer	Full OEM/ODM capabilities. ISO certified.	\N	200.00	\N	\N	\N	\N	\N	\N	0	\N
63	test-user-001	Elite Eyewear Partners	https://www.eliteeyewearpartners.com	csv	{}	active	2026-07-01 17:09:52.164761	t	verified	\N	\N	Sandra Nguyen	sandra.nguyen@eliteeyewearpartners.com	+81 600 3698	other	sample-available, white-label, premium, MOQ-high, private-label	Hong Kong	5-10 days	Credit Card	Curated product selection. Personal account manager.	\N	200.00	\N	\N	\N	\N	\N	\N	0	\N
64	test-user-001	Universal Furniture Company	https://www.universalfurnitureco.org	csv	{}	active	2026-07-01 17:09:52.164761	t	verified	\N	\N	Mason Flores	mason.flores@universalfurniturecompany.com	+91 400 5624	distributor	retail-ready, verified-supplier, global-shipping, MOQ-low, factory-direct	Singapore	3-5 days	Letter of Credit	Authorized distributor for major brands.	\N	200.00	\N	\N	\N	\N	\N	\N	0	\N
65	test-user-001	Pacific Baby Products Direct	https://www.pacificbabyproductsd.com	api	{}	active	2026-07-01 17:09:52.164761	t	verified	\N	\N	Lucas Smith	lucas.smith@pacificbabyproductsdirect.com	+86 200 3637	other	sample-available, white-label, MOQ-high, free-samples, eco-friendly	Thailand	3-7 days	Net 15	Curated product selection. Personal account manager.	\N	500.00	\N	\N	\N	\N	\N	\N	0	\N
66	test-user-001	Atlas Home Decor Industries	https://www.atlashomedecorindust.com	api	{}	active	2026-07-01 17:09:52.164761	t	verified	\N	\N	Robert Patel	robert.patel@atlashomedecorindustries.com	+86 500 6979	wholesale	bulk-discount, MOQ-high, wholesale-only, factory-direct, premium, MOQ-high	South Korea	7-10 days	Western Union	Long-standing supplier with consistent quality.	\N	200.00	\N	\N	\N	\N	\N	\N	0	\N
67	test-user-001	Peak Stationery International	https://www.peakstationeryintern.org	api	{}	active	2026-07-01 17:09:52.164761	t	verified	\N	\N	Donald Robinson	donald.robinson@peakstationeryinternational.com	+49 200 2538	manufacturer	private-label, custom-packaging, certified, private-label, bulk-discount, wholesale-only	Taiwan	15-30 days	Net 90	In-house design team. Custom packaging available.	\N	\N	\N	\N	\N	\N	\N	\N	0	\N
68	test-user-001	Apex Automotive Inc.	https://www.apexautomotiveinc.org	custom	{}	active	2026-07-01 17:09:52.164761	t	verified	\N	\N	Yuko Choi	yuko.choi@apexautomotiveinc.com	+49 200 2671	manufacturer	private-label, custom-packaging, certified, bulk-discount, wholesale-only, dropship-ready	Thailand	5-10 days	Net 60	Full OEM/ODM capabilities. ISO certified.	\N	500.00	\N	\N	\N	\N	\N	\N	0	\N
69	test-user-001	Apex Kitchen & Dining Sourcing	https://www.apexkitchendiningsou.org	feed	{}	active	2026-07-01 17:09:52.164761	t	verified	\N	\N	Betty Campbell	betty.campbell@apexkitchendiningsourcing.com	+1 600 6872	other	sample-available, white-label, eco-friendly, premium, factory-direct	Turkey	5-7 days	Net 30	Specialty supplier. Flexible terms.	\N	\N	\N	\N	\N	\N	\N	\N	0	\N
70	test-user-001	Apex Home Decor International	https://www.apexhomedecorinterna.org	api	{}	active	2026-07-01 17:09:52.164761	t	verified	\N	\N	Kenneth Davis	kenneth.davis@apexhomedecorinternational.com	+1 600 7513	dropshipper	dropship-ready, fast-shipping, global-shipping, MOQ-low, sample-available, fast-shipping	Singapore	14-21 days	Net 30	Automated dropshipping. No minimum order.	\N	100.00	\N	\N	\N	\N	\N	\N	0	\N
71	test-user-001	Supreme Eyewear Corp.	https://www.supremeeyewearcorp.com	feed	{}	active	2026-07-01 17:09:52.164761	t	verified	\N	\N	Liam Lee	liam.lee@supremeeyewearcorp.com	+1 400 1446	manufacturer	private-label, custom-packaging, certified, retail-ready, white-label, wholesale-only	Italy	14-21 days	PayPal	In-house design team. Custom packaging available.	\N	500.00	\N	\N	\N	\N	\N	\N	0	\N
72	test-user-001	Universal Electronics Industries	https://www.universalelectronics.org	csv	{}	active	2026-07-01 17:09:52.164761	t	verified	\N	\N	Hiroshi Parker	hiroshi.parker@universalelectronicsindustries.com	+86 200 6925	wholesale	bulk-discount, MOQ-high, wholesale-only, factory-direct, global-shipping, sample-available	Bangladesh	5-7 days	Net 45	Factory-direct pricing. Samples available.	\N	500.00	\N	\N	\N	\N	\N	\N	0	\N
73	test-user-001	Atlas Watches Industries	https://www.atlaswatchesindustri.net	feed	{}	active	2026-07-01 17:09:52.164761	t	verified	\N	\N	Paul Zhang	paul.zhang@atlaswatchesindustries.com	+91 600 2001	distributor	retail-ready, verified-supplier, white-label, fast-shipping, certified	Malaysia	10-15 days	Net 90	Multi-brand distributor. Same-day dispatch.	\N	1000.00	\N	\N	\N	\N	\N	\N	0	\N
74	test-user-001	Pacific Furniture Solutions	https://www.pacificfurnituresolu.org	custom	{}	active	2026-07-01 17:09:52.164761	t	verified	\N	\N	Jacob Park	jacob.park@pacificfurnituresolutions.com	+44 200 3601	wholesale	bulk-discount, MOQ-high, wholesale-only, factory-direct, dropship-ready, bulk-discount	Malaysia	3-7 days	Wire Transfer	Long-standing supplier with consistent quality.	\N	1000.00	\N	\N	\N	\N	\N	\N	0	\N
75	test-user-001	Prime Automotive Corp.	https://www.primeautomotivecorp.net	custom	{}	active	2026-07-01 17:09:52.164761	t	verified	\N	\N	Jeffrey Nelson	jeffrey.nelson@primeautomotivecorp.com	+86 500 9595	other	sample-available, white-label, private-label, custom-packaging, wholesale-only	Poland	10-15 days	Wire Transfer	Specialty supplier. Flexible terms.	\N	\N	\N	\N	\N	\N	\N	\N	0	\N
76	test-user-001	Peak Baby Products Holdings	https://www.peakbabyproductshold.net	csv	{}	active	2026-07-01 17:09:52.164761	t	verified	\N	\N	Eric Adams	eric.adams@peakbabyproductsholdings.com	+86 500 1610	distributor	retail-ready, verified-supplier, premium, private-label, wholesale-only	Thailand	7-10 days	PayPal + Net 30	Multi-brand distributor. Same-day dispatch.	\N	200.00	\N	\N	\N	\N	\N	\N	0	\N
77	test-user-001	Premier Electronics International	https://www.premierelectronicsin.net	custom	{}	active	2026-07-01 17:09:52.164761	t	verified	\N	\N	Isabella Martinez	isabella.martinez@premierelectronicsinternational.com	+33 500 3477	wholesale	bulk-discount, MOQ-high, wholesale-only, factory-direct, wholesale-only, bulk-discount	Vietnam	1-2 weeks	Net 15	Long-standing supplier with consistent quality.	\N	200.00	\N	\N	\N	\N	\N	\N	0	\N
78	test-user-001	Zenith Bags & Luggage Company	https://www.zenithbagsluggagecom.net	csv	{}	active	2026-07-01 17:09:52.164761	t	verified	\N	\N	Patricia Martin	patricia.martin@zenithbagsluggagecompany.com	+86 400 9474	distributor	retail-ready, verified-supplier, premium, fast-shipping, organic-certified	UK	7-12 days	Net 90	Authorized distributor for major brands.	\N	200.00	\N	\N	\N	\N	\N	\N	0	\N
79	test-user-001	Premier Jewelry & Accessories Inc.	https://www.premierjewelryaccess.org	api	{}	active	2026-07-01 17:09:52.164761	t	verified	\N	\N	Ryan Wright	ryan.wright@premierjewelryaccessoriesinc.com	+91 200 9384	other	sample-available, white-label, MOQ-high, eco-friendly, global-shipping	Taiwan	1-2 weeks	Net 90	Curated product selection. Personal account manager.	\N	100.00	\N	\N	\N	\N	\N	\N	0	\N
80	test-user-001	Prime Beauty & Personal Care Sourcing	https://www.primebeautypersonalc.net	custom	{}	active	2026-07-01 17:09:52.164761	t	verified	\N	\N	Ahmed Parker	ahmed.parker@primebeautypersonalcaresourcing.com	+33 400 8470	manufacturer	private-label, custom-packaging, certified, white-label, fast-shipping, premium	Australia	3-5 days	Wire Transfer	In-house design team. Custom packaging available.	\N	200.00	\N	\N	\N	\N	\N	\N	0	\N
81	test-user-001	Vertex Bags & Luggage Direct	https://www.vertexbagsluggagedir.org	csv	{}	active	2026-07-01 17:09:52.164761	t	verified	\N	\N	Margaret Brown	margaret.brown@vertexbagsluggagedirect.com	+86 500 5493	dropshipper	dropship-ready, fast-shipping, global-shipping, MOQ-low, sample-available, bulk-discount	Sri Lanka	3-7 days	Western Union	Worldwide shipping with tracking. Fulfillment within 24h.	\N	500.00	\N	\N	\N	\N	\N	\N	0	\N
82	test-user-001	Elite Tools & Hardware Industries	https://www.elitetoolshardwarein.org	feed	{}	active	2026-07-01 17:09:52.164761	t	verified	\N	\N	Dorothy Collins	dorothy.collins@elitetoolshardwareindustries.com	+81 400 1536	wholesale	bulk-discount, MOQ-high, wholesale-only, factory-direct, bulk-discount, private-label	UAE	2-3 weeks	Letter of Credit	Bulk orders only. MOQ applies.	\N	500.00	\N	\N	\N	\N	\N	\N	0	\N
83	test-user-001	Pacific Automotive Limited	https://www.pacificautomotivelim.net	custom	{}	active	2026-07-01 17:09:52.164761	t	verified	\N	\N	Priya Johnson	priya.johnson@pacificautomotivelimited.com	+86 500 5512	dropshipper	dropship-ready, fast-shipping, global-shipping, MOQ-low, sample-available, dropship-ready	Netherlands	15-30 days	Net 15	Worldwide shipping with tracking. Fulfillment within 24h.	\N	500.00	\N	\N	\N	\N	\N	\N	0	\N
84	test-user-001	Royal Stationery Holdings	https://www.royalstationeryholdi.net	custom	{}	active	2026-07-01 17:09:52.164761	t	verified	\N	\N	Jeffrey Adams	jeffrey.adams@royalstationeryholdings.com	+1 200 3915	manufacturer	private-label, custom-packaging, certified, white-label, sample-available, private-label	Indonesia	3-5 days	PayPal	In-house design team. Custom packaging available.	\N	1000.00	\N	\N	\N	\N	\N	\N	0	\N
85	test-user-001	Global Shoes Partners	https://www.globalshoespartners.com	api	{}	active	2026-07-01 17:09:52.164761	t	verified	\N	\N	Jeffrey Miller	jeffrey.miller@globalshoespartners.com	+91 300 3071	distributor	retail-ready, verified-supplier, fast-shipping, MOQ-high, global-shipping	South Korea	7-14 days	Net 60	Authorized distributor for major brands.	\N	200.00	\N	\N	\N	\N	\N	\N	0	\N
86	test-user-001	Nova Electronics Inc.	https://www.novaelectronicsinc.org	feed	{}	active	2026-07-01 17:09:52.164761	t	verified	\N	\N	Ashley Jones	ashley.jones@novaelectronicsinc.com	+86 200 2850	wholesale	bulk-discount, MOQ-high, wholesale-only, factory-direct, free-samples, bulk-discount	South Korea	3-7 days	Credit Card	Factory-direct pricing. Samples available.	\N	500.00	\N	\N	\N	\N	\N	\N	0	\N
87	test-user-001	Pacific Stationery Industries	https://www.pacificstationeryind.org	api	{}	active	2026-07-01 17:09:52.164761	t	verified	\N	\N	Barbara Garcia	barbara.garcia@pacificstationeryindustries.com	+1 400 7544	wholesale	bulk-discount, MOQ-high, wholesale-only, factory-direct, wholesale-only, custom-packaging	Turkey	15-30 days	T/T	Long-standing supplier with consistent quality.	\N	\N	\N	\N	\N	\N	\N	\N	0	\N
88	test-user-001	Prime Party Supplies Inc.	https://www.primepartysuppliesin.net	api	{}	active	2026-07-01 17:09:52.164761	t	verified	\N	\N	Christopher Hernandez	christopher.hernandez@primepartysuppliesinc.com	+33 400 1561	distributor	retail-ready, verified-supplier, fast-shipping, global-shipping, white-label	China	1-2 weeks	Net 15	Multi-brand distributor. Same-day dispatch.	\N	500.00	\N	\N	\N	\N	\N	\N	0	\N
89	test-user-001	Vertex Fashion Partners	https://www.vertexfashionpartner.com	custom	{}	active	2026-07-01 17:09:52.164761	t	verified	\N	\N	Stephanie Gomez	stephanie.gomez@vertexfashionpartners.com	+44 700 6336	other	sample-available, white-label, eco-friendly, certified, MOQ-low	China	15-30 days	Western Union	Curated product selection. Personal account manager.	\N	200.00	\N	\N	\N	\N	\N	\N	0	\N
90	test-user-001	Zenith Home Decor Direct	https://www.zenithhomedecordirec.com	custom	{}	active	2026-07-01 17:09:52.164761	t	verified	\N	\N	Mia Rodriguez	mia.rodriguez@zenithhomedecordirect.com	+81 200 2450	wholesale	bulk-discount, MOQ-high, wholesale-only, factory-direct, fast-shipping, dropship-ready	Taiwan	5-10 days	T/T	Long-standing supplier with consistent quality.	\N	500.00	\N	\N	\N	\N	\N	\N	0	\N
91	test-user-001	Elite Bags & Luggage Group	https://www.elitebagsluggagegrou.net	csv	{}	active	2026-07-01 17:09:52.164761	t	verified	\N	\N	Raj Nguyen	raj.nguyen@elitebagsluggagegroup.com	+81 400 7862	distributor	retail-ready, verified-supplier, sample-available, fast-shipping, premium	Brazil	3-7 days	Wire Transfer	Authorized distributor for major brands.	\N	100.00	\N	\N	\N	\N	\N	\N	0	\N
92	test-user-001	Vertex Electronics Partners	https://www.vertexelectronicspar.com	custom	{}	active	2026-07-01 17:09:52.164761	t	verified	\N	\N	Joshua Diaz	joshua.diaz@vertexelectronicspartners.com	+49 400 9280	other	sample-available, white-label, eco-friendly, MOQ-low, private-label	Spain	7-10 days	Credit Card	Specialty supplier. Flexible terms.	\N	\N	\N	\N	\N	\N	\N	\N	0	\N
93	test-user-001	Global Home Decor Direct	https://www.globalhomedecordirec.net	custom	{}	active	2026-07-01 17:09:52.164761	t	verified	\N	\N	William Mitchell	william.mitchell@globalhomedecordirect.com	+1 500 4117	wholesale	bulk-discount, MOQ-high, wholesale-only, factory-direct, retail-ready, bulk-discount	Poland	3-7 days	PayPal + Net 30	Long-standing supplier with consistent quality.	\N	1000.00	\N	\N	\N	\N	\N	\N	0	\N
94	test-user-001	Premier Kitchen & Dining Partners	https://www.premierkitchendining.com	feed	{}	active	2026-07-01 17:09:52.164761	t	verified	\N	\N	Stephanie Kim	stephanie.kim@premierkitchendiningpartners.com	+86 400 1737	manufacturer	private-label, custom-packaging, certified, custom-packaging, verified-supplier, free-samples	UK	14-21 days	Wire Transfer	Full OEM/ODM capabilities. ISO certified.	\N	\N	\N	\N	\N	\N	\N	\N	0	\N
95	test-user-001	Delta Electronics Supplies	https://www.deltaelectronicssupp.net	csv	{}	active	2026-07-01 17:09:52.164761	t	verified	\N	\N	Eric Torres	eric.torres@deltaelectronicssupplies.com	+33 200 7826	distributor	retail-ready, verified-supplier, factory-direct, quality-assured, eco-friendly	Poland	7-14 days	T/T	Authorized distributor for major brands.	\N	200.00	\N	\N	\N	\N	\N	\N	0	\N
96	test-user-001	Universal Fashion Direct	https://www.universalfashiondire.net	api	{}	active	2026-07-01 17:09:52.164761	t	verified	\N	\N	Lisa Lopez	lisa.lopez@universalfashiondirect.com	+44 600 5474	other	sample-available, white-label, free-samples, verified-supplier, organic-certified	Sri Lanka	3-7 days	T/T	Specialty supplier. Flexible terms.	\N	50.00	\N	\N	\N	\N	\N	\N	0	\N
97	test-user-001	Atlas Crafts & Sewing Partners	https://www.atlascraftssewingpar.org	api	{}	active	2026-07-01 17:09:52.164761	t	verified	\N	\N	Satoshi Chen	satoshi.chen@atlascraftssewingpartners.com	+44 200 3587	distributor	retail-ready, verified-supplier, premium, verified-supplier, bulk-discount	Hong Kong	3-5 days	PayPal + Net 30	Multi-brand distributor. Same-day dispatch.	\N	1000.00	\N	\N	\N	\N	\N	\N	0	\N
98	test-user-001	Omega Bags & Luggage Solutions	https://www.omegabagsluggagesolu.com	csv	{}	active	2026-07-01 17:09:52.164761	t	verified	\N	\N	Thomas Liu	thomas.liu@omegabagsluggagesolutions.com	+91 500 5155	manufacturer	private-label, custom-packaging, certified, dropship-ready, wholesale-only, bulk-discount	Turkey	7-10 days	Western Union	Full OEM/ODM capabilities. ISO certified.	\N	200.00	\N	\N	\N	\N	\N	\N	0	\N
99	test-user-001	Nova Automotive Limited	https://www.novaautomotivelimite.org	api	{}	active	2026-07-01 17:09:52.164761	t	verified	\N	\N	Elizabeth Hernandez	elizabeth.hernandez@novaautomotivelimited.com	+49 400 5429	other	sample-available, white-label, organic-certified, private-label, factory-direct	Canada	15-30 days	Net 15	Specialty supplier. Flexible terms.	\N	1000.00	\N	\N	\N	\N	\N	\N	0	\N
100	test-user-001	Vertex Furniture Corp.	https://www.vertexfurniturecorp.com	feed	{}	active	2026-07-01 17:09:52.164761	t	verified	\N	\N	Priya Robinson	priya.robinson@vertexfurniturecorp.com	+49 300 4300	manufacturer	private-label, custom-packaging, certified, retail-ready, private-label, MOQ-low	Japan	14-21 days	Net 15	In-house design team. Custom packaging available.	\N	100.00	\N	\N	\N	\N	\N	\N	0	\N
101	test-user-001	Royal Health & Wellness Supplies	https://www.royalhealthwellnesss.net	custom	{}	active	2026-07-01 17:09:52.164761	t	verified	\N	\N	Ronald Mitchell	ronald.mitchell@royalhealthwellnesssupplies.com	+49 300 6939	distributor	retail-ready, verified-supplier, retail-ready, eco-friendly, bulk-discount	Bangladesh	7-14 days	Western Union	Multi-brand distributor. Same-day dispatch.	\N	1000.00	\N	\N	\N	\N	\N	\N	0	\N
102	test-user-001	Zenith Baby Products Holdings	https://www.zenithbabyproductsho.net	csv	{}	active	2026-07-01 17:09:52.164761	t	verified	\N	\N	Robert Yang	robert.yang@zenithbabyproductsholdings.com	+44 400 1809	wholesale	bulk-discount, MOQ-high, wholesale-only, factory-direct, premium, certified	Turkey	15-30 days	PayPal	Long-standing supplier with consistent quality.	\N	1000.00	\N	\N	\N	\N	\N	\N	0	\N
103	test-user-001	Premier Stationery Sourcing	https://www.premierstationerysou.com	csv	{}	active	2026-07-01 17:09:52.164761	t	verified	\N	\N	Donna Phillips	donna.phillips@premierstationerysourcing.com	+81 500 7017	distributor	retail-ready, verified-supplier, wholesale-only, certified, custom-packaging	Poland	1-2 weeks	PayPal	Multi-brand distributor. Same-day dispatch.	\N	100.00	\N	\N	\N	\N	\N	\N	0	\N
104	test-user-001	Summit Kitchen & Dining Partners	https://www.summitkitchendiningp.net	custom	{}	active	2026-07-01 17:09:52.193025	t	verified	\N	\N	Ahmed White	ahmed.white@summitkitchendiningpartners.com	+86 700 5146	other	sample-available, white-label, eco-friendly, custom-packaging, verified-supplier	Thailand	3-5 days	PayPal + Net 30	Curated product selection. Personal account manager.	\N	\N	\N	\N	\N	\N	\N	\N	0	\N
105	test-user-001	Royal Watches Group	https://www.royalwatchesgroup.net	api	{}	active	2026-07-01 17:09:52.193025	t	verified	\N	\N	Jennifer Wright	jennifer.wright@royalwatchesgroup.com	+33 400 5230	dropshipper	dropship-ready, fast-shipping, global-shipping, MOQ-low, sample-available, fast-shipping	Bangladesh	14-21 days	Net 30	Worldwide shipping with tracking. Fulfillment within 24h.	\N	1000.00	\N	\N	\N	\N	\N	\N	0	\N
106	test-user-001	Titan Baby Products International	https://www.titanbabyproductsint.com	csv	{}	active	2026-07-01 17:09:52.193025	t	verified	\N	\N	John Davis	john.davis@titanbabyproductsinternational.com	+81 700 8011	dropshipper	dropship-ready, fast-shipping, global-shipping, MOQ-low, sample-available, eco-friendly	Vietnam	15-30 days	Net 30	Automated dropshipping. No minimum order.	\N	\N	\N	\N	\N	\N	\N	\N	0	\N
107	test-user-001	Nova Pet Supplies Trading Co.	https://www.novapetsuppliestradi.net	feed	{}	active	2026-07-01 17:09:52.193025	t	verified	\N	\N	Min Yang	min.yang@novapetsuppliestradingco.com	+1 700 3879	wholesale	bulk-discount, MOQ-high, wholesale-only, factory-direct, MOQ-high, free-samples	Singapore	2-3 weeks	T/T	Bulk orders only. MOQ applies.	\N	\N	\N	\N	\N	\N	\N	\N	0	\N
108	test-user-001	Supreme Baby Products Sourcing	https://www.supremebabyproductss.net	api	{}	active	2026-07-01 17:09:52.193025	t	verified	\N	\N	Cynthia Parker	cynthia.parker@supremebabyproductssourcing.com	+33 500 6218	manufacturer	private-label, custom-packaging, certified, white-label, private-label, verified-supplier	Indonesia	15-30 days	Wire Transfer	Full OEM/ODM capabilities. ISO certified.	\N	1000.00	\N	\N	\N	\N	\N	\N	0	\N
109	test-user-001	Universal Stationery Solutions	https://www.universalstationerys.com	custom	{}	active	2026-07-01 17:09:52.193025	t	verified	\N	\N	Wei Choi	wei.choi@universalstationerysolutions.com	+81 600 9318	other	sample-available, white-label, fast-shipping, dropship-ready, verified-supplier	Turkey	5-10 days	PayPal + Net 30	Curated product selection. Personal account manager.	\N	100.00	\N	\N	\N	\N	\N	\N	0	\N
110	test-user-001	Apex Electronics Limited	https://www.apexelectronicslimit.org	feed	{}	active	2026-07-01 17:09:52.193025	t	verified	\N	\N	Ashley Carter	ashley.carter@apexelectronicslimited.com	+91 700 5555	wholesale	bulk-discount, MOQ-high, wholesale-only, factory-direct, MOQ-low, wholesale-only	Poland	15-30 days	Wire Transfer	Long-standing supplier with consistent quality.	\N	100.00	\N	\N	\N	\N	\N	\N	0	\N
111	test-user-001	Nova Home Decor Trading Co.	https://www.novahomedecortrading.net	custom	{}	active	2026-07-01 17:09:52.193025	t	verified	\N	\N	Matthew Park	matthew.park@novahomedecortradingco.com	+81 600 3912	manufacturer	private-label, custom-packaging, certified, MOQ-low, fast-shipping, quality-assured	Indonesia	7-14 days	Net 30	In-house design team. Custom packaging available.	\N	\N	\N	\N	\N	\N	\N	\N	0	\N
112	test-user-001	Titan Camping & Hiking Enterprise	https://www.titancampinghikingen.com	feed	{}	active	2026-07-01 17:09:52.193025	t	verified	\N	\N	Isabella Yamamoto	isabella.yamamoto@titancampinghikingenterprise.com	+91 500 4063	manufacturer	private-label, custom-packaging, certified, premium, MOQ-low, factory-direct	Germany	7-12 days	PayPal	Full OEM/ODM capabilities. ISO certified.	\N	\N	\N	\N	\N	\N	\N	\N	0	\N
113	test-user-001	Alpha Shoes Direct	https://www.alphashoesdirect.com	feed	{}	active	2026-07-01 17:09:52.193025	t	verified	\N	\N	Hiroshi Johnson	hiroshi.johnson@alphashoesdirect.com	+44 300 7924	distributor	retail-ready, verified-supplier, dropship-ready, white-label, wholesale-only	Taiwan	3-7 days	Western Union	Authorized distributor for major brands.	\N	50.00	\N	\N	\N	\N	\N	\N	0	\N
114	test-user-001	Vertex Automotive Holdings	https://www.vertexautomotivehold.com	feed	{}	active	2026-07-01 17:09:52.193025	t	verified	\N	\N	Lisa Kim	lisa.kim@vertexautomotiveholdings.com	+86 400 3271	other	sample-available, white-label, wholesale-only, premium, fast-shipping	Philippines	5-10 days	Net 15	Specialty supplier. Flexible terms.	\N	200.00	\N	\N	\N	\N	\N	\N	0	\N
115	test-user-001	Prime Electronics Corp.	https://www.primeelectronicscorp.net	csv	{}	active	2026-07-01 17:09:52.193025	t	verified	\N	\N	Gary Nguyen	gary.nguyen@primeelectronicscorp.com	+1 300 1877	wholesale	bulk-discount, MOQ-high, wholesale-only, factory-direct, free-samples, global-shipping	Pakistan	14-21 days	Letter of Credit	Bulk orders only. MOQ applies.	\N	500.00	\N	\N	\N	\N	\N	\N	0	\N
116	test-user-001	Pacific Phone Accessories Holdings	https://www.pacificphoneaccessor.org	csv	{}	active	2026-07-01 17:09:52.193025	t	verified	\N	\N	Melissa Scott	melissa.scott@pacificphoneaccessoriesholdings.com	+81 500 9742	dropshipper	dropship-ready, fast-shipping, global-shipping, MOQ-low, sample-available, private-label	Mexico	7-12 days	Letter of Credit	Worldwide shipping with tracking. Fulfillment within 24h.	\N	200.00	\N	\N	\N	\N	\N	\N	0	\N
117	test-user-001	Nova Phone Accessories Enterprise	https://www.novaphoneaccessories.net	api	{}	active	2026-07-01 17:09:52.193025	t	verified	\N	\N	William Zhang	william.zhang@novaphoneaccessoriesenterprise.com	+91 600 2787	dropshipper	dropship-ready, fast-shipping, global-shipping, MOQ-low, sample-available, custom-packaging	Canada	1-2 weeks	PayPal + Net 30	Worldwide shipping with tracking. Fulfillment within 24h.	\N	200.00	\N	\N	\N	\N	\N	\N	0	\N
118	test-user-001	Zenith Furniture Direct	https://www.zenithfurnituredirec.net	api	{}	active	2026-07-01 17:09:52.193025	t	verified	\N	\N	Min Flores	min.flores@zenithfurnituredirect.com	+81 300 9467	other	sample-available, white-label, eco-friendly, certified, custom-packaging	Singapore	3-7 days	T/T	Specialty supplier. Flexible terms.	\N	50.00	\N	\N	\N	\N	\N	\N	0	\N
119	test-user-001	Alpha Kitchen & Dining Limited	https://www.alphakitchendiningli.com	feed	{}	active	2026-07-01 17:09:52.193025	t	verified	\N	\N	Satoshi Robinson	satoshi.robinson@alphakitchendininglimited.com	+86 300 8306	distributor	retail-ready, verified-supplier, white-label, fast-shipping, global-shipping	Singapore	1-2 weeks	PayPal + Net 30	Multi-brand distributor. Same-day dispatch.	\N	\N	\N	\N	\N	\N	\N	\N	0	\N
120	test-user-001	Premier Shoes Supplies	https://www.premiershoessupplies.org	api	{}	active	2026-07-01 17:09:52.193025	t	verified	\N	\N	Kevin Flores	kevin.flores@premiershoessupplies.com	+86 500 1042	other	sample-available, white-label, certified, fast-shipping, free-samples	South Korea	7-14 days	Credit Card	Curated product selection. Personal account manager.	\N	100.00	\N	\N	\N	\N	\N	\N	0	\N
121	test-user-001	Alpha Stationery Inc.	https://www.alphastationeryinc.com	csv	{}	active	2026-07-01 17:09:52.193025	t	verified	\N	\N	Gary Hernandez	gary.hernandez@alphastationeryinc.com	+91 200 2224	distributor	retail-ready, verified-supplier, bulk-discount, global-shipping, fast-shipping	UAE	7-14 days	Wire Transfer	Authorized distributor for major brands.	\N	50.00	\N	\N	\N	\N	\N	\N	0	\N
122	test-user-001	Summit Automotive Holdings	https://www.summitautomotivehold.net	api	{}	active	2026-07-01 17:09:52.193025	t	verified	\N	\N	Raj Hall	raj.hall@summitautomotiveholdings.com	+44 600 4909	other	sample-available, white-label, private-label, sample-available, factory-direct	Japan	7-10 days	Net 90	Curated product selection. Personal account manager.	\N	100.00	\N	\N	\N	\N	\N	\N	0	\N
123	test-user-001	Pacific Beauty & Personal Care Enterprise	https://www.pacificbeautypersona.com	custom	{}	active	2026-07-01 17:09:52.193025	t	verified	\N	\N	Sophia Park	sophia.park@pacificbeautypersonalcareenterprise.com	+1 400 8246	manufacturer	private-label, custom-packaging, certified, fast-shipping, MOQ-low, dropship-ready	Italy	2-3 weeks	Western Union	Full OEM/ODM capabilities. ISO certified.	\N	\N	\N	\N	\N	\N	\N	\N	0	\N
124	test-user-001	Peak Eyewear Trading Co.	https://www.peakeyeweartradingco.com	feed	{}	active	2026-07-01 17:09:52.193025	t	verified	\N	\N	Jason Adams	jason.adams@peakeyeweartradingco.com	+1 600 4860	dropshipper	dropship-ready, fast-shipping, global-shipping, MOQ-low, sample-available, certified	Malaysia	2-3 weeks	Wire Transfer	Worldwide shipping with tracking. Fulfillment within 24h.	\N	\N	\N	\N	\N	\N	\N	\N	0	\N
125	test-user-001	Zenith Jewelry & Accessories Enterprise	https://www.zenithjewelryaccesso.com	csv	{}	active	2026-07-01 17:09:52.193025	t	verified	\N	\N	Gary Young	gary.young@zenithjewelryaccessoriesenterprise.com	+1 300 5081	other	sample-available, white-label, retail-ready, global-shipping, MOQ-high	China	7-10 days	Wire Transfer	Curated product selection. Personal account manager.	\N	200.00	\N	\N	\N	\N	\N	\N	0	\N
126	test-user-001	Prime Home & Garden Solutions	https://www.primehomegardensolut.com	csv	{}	active	2026-07-01 17:09:52.193025	t	verified	\N	\N	Cynthia Green	cynthia.green@primehomegardensolutions.com	+81 300 8756	dropshipper	dropship-ready, fast-shipping, global-shipping, MOQ-low, sample-available, sample-available	Netherlands	10-15 days	PayPal	Automated dropshipping. No minimum order.	\N	100.00	\N	\N	\N	\N	\N	\N	0	\N
127	test-user-001	Universal Health & Wellness Corp.	https://www.universalhealthwelln.com	api	{}	active	2026-07-01 17:09:52.193025	t	verified	\N	\N	Hiroshi Chen	hiroshi.chen@universalhealthwellnesscorp.com	+91 200 9953	other	sample-available, white-label, MOQ-high, white-label, custom-packaging	Netherlands	1-2 weeks	Net 90	Specialty supplier. Flexible terms.	\N	100.00	\N	\N	\N	\N	\N	\N	0	\N
128	test-user-001	Delta Stationery Corp.	https://www.deltastationerycorp.net	custom	{}	active	2026-07-01 17:09:52.193025	t	verified	\N	\N	Liam Harris	liam.harris@deltastationerycorp.com	+1 200 9426	dropshipper	dropship-ready, fast-shipping, global-shipping, MOQ-low, sample-available, premium	Bangladesh	7-14 days	Net 30	Automated dropshipping. No minimum order.	\N	\N	\N	\N	\N	\N	\N	\N	0	\N
129	test-user-001	Omega Kitchen & Dining Solutions	https://www.omegakitchendiningso.org	custom	{}	active	2026-07-01 17:09:52.193025	t	verified	\N	\N	Ryan Wang	ryan.wang@omegakitchendiningsolutions.com	+49 500 9756	dropshipper	dropship-ready, fast-shipping, global-shipping, MOQ-low, sample-available, bulk-discount	Sri Lanka	10-15 days	Credit Card	Automated dropshipping. No minimum order.	\N	\N	\N	\N	\N	\N	\N	\N	0	\N
130	test-user-001	Global Lighting Direct	https://www.globallightingdirect.com	feed	{}	active	2026-07-01 17:09:52.193025	t	verified	\N	\N	Kenneth Lopez	kenneth.lopez@globallightingdirect.com	+44 400 9123	manufacturer	private-label, custom-packaging, certified, MOQ-low, organic-certified, sample-available	Australia	10-15 days	Net 60	In-house design team. Custom packaging available.	\N	\N	\N	\N	\N	\N	\N	\N	0	\N
131	test-user-001	Prime Shoes Inc.	https://www.primeshoesinc.org	custom	{}	active	2026-07-01 17:09:52.193025	t	verified	\N	\N	Emily Anderson	emily.anderson@primeshoesinc.com	+91 500 6230	distributor	retail-ready, verified-supplier, bulk-discount, fast-shipping, wholesale-only	India	14-21 days	PayPal	Multi-brand distributor. Same-day dispatch.	\N	1000.00	\N	\N	\N	\N	\N	\N	0	\N
132	test-user-001	Royal Bags & Luggage Industries	https://www.royalbagsluggageindu.net	api	{}	active	2026-07-01 17:09:52.193025	t	verified	\N	\N	Barbara Taylor	barbara.taylor@royalbagsluggageindustries.com	+49 500 7526	distributor	retail-ready, verified-supplier, MOQ-low, private-label, wholesale-only	Australia	10-15 days	Net 30	Authorized distributor for major brands.	\N	\N	\N	\N	\N	\N	\N	\N	0	\N
133	test-user-001	Summit Health & Wellness Corp.	https://www.summithealthwellness.com	feed	{}	active	2026-07-01 17:09:52.193025	t	verified	\N	\N	Linda Wilson	linda.wilson@summithealthwellnesscorp.com	+44 600 8839	manufacturer	private-label, custom-packaging, certified, organic-certified, retail-ready, global-shipping	Malaysia	1-2 weeks	Net 90	Full OEM/ODM capabilities. ISO certified.	\N	200.00	\N	\N	\N	\N	\N	\N	0	\N
134	test-user-001	Delta Baby Products Enterprise	https://www.deltababyproductsent.com	custom	{}	active	2026-07-01 17:09:52.193025	t	verified	\N	\N	Noah Gomez	noah.gomez@deltababyproductsenterprise.com	+33 500 3213	wholesale	bulk-discount, MOQ-high, wholesale-only, factory-direct, wholesale-only, sample-available	Brazil	7-10 days	Net 90	Factory-direct pricing. Samples available.	\N	50.00	\N	\N	\N	\N	\N	\N	0	\N
135	test-user-001	Delta Clothing International	https://www.deltaclothinginterna.net	csv	{}	active	2026-07-01 17:09:52.193025	t	verified	\N	\N	Mia Smith	mia.smith@deltaclothinginternational.com	+1 700 4883	wholesale	bulk-discount, MOQ-high, wholesale-only, factory-direct, bulk-discount, MOQ-low	Sri Lanka	7-14 days	Net 30	Bulk orders only. MOQ applies.	\N	\N	\N	\N	\N	\N	\N	\N	0	\N
136	test-user-001	Nova Stationery Sourcing	https://www.novastationerysourci.org	csv	{}	active	2026-07-01 17:09:52.193025	t	verified	\N	\N	Nicholas Park	nicholas.park@novastationerysourcing.com	+49 600 3044	manufacturer	private-label, custom-packaging, certified, premium, MOQ-high, dropship-ready	India	2-3 weeks	Wire Transfer	Full OEM/ODM capabilities. ISO certified.	\N	50.00	\N	\N	\N	\N	\N	\N	0	\N
137	test-user-001	Supreme Beauty & Personal Care International	https://www.supremebeautypersona.org	custom	{}	active	2026-07-01 17:09:52.193025	t	verified	\N	\N	Noah Cruz	noah.cruz@supremebeautypersonalcareinternational.com	+33 500 3346	distributor	retail-ready, verified-supplier, retail-ready, fast-shipping, organic-certified	Italy	7-10 days	Net 90	Multi-brand distributor. Same-day dispatch.	\N	\N	\N	\N	\N	\N	\N	\N	0	\N
138	test-user-001	Elite Phone Accessories Solutions	https://www.elitephoneaccessorie.net	csv	{}	active	2026-07-01 17:09:52.193025	t	verified	\N	\N	Brian Carter	brian.carter@elitephoneaccessoriessolutions.com	+49 700 7501	distributor	retail-ready, verified-supplier, bulk-discount, custom-packaging, fast-shipping	Mexico	7-12 days	Credit Card	Authorized distributor for major brands.	\N	500.00	\N	\N	\N	\N	\N	\N	0	\N
139	test-user-001	Elite Beauty & Personal Care International	https://www.elitebeautypersonalc.org	csv	{}	active	2026-07-01 17:09:52.193025	t	verified	\N	\N	Jung Scott	jung.scott@elitebeautypersonalcareinternational.com	+44 600 7545	distributor	retail-ready, verified-supplier, wholesale-only, organic-certified, fast-shipping	India	15-30 days	Western Union	Multi-brand distributor. Same-day dispatch.	\N	\N	\N	\N	\N	\N	\N	\N	0	\N
140	test-user-001	Premier Home & Garden Direct	https://www.premierhomegardendir.com	api	{}	active	2026-07-01 17:09:52.193025	t	verified	\N	\N	Timothy Zhang	timothy.zhang@premierhomegardendirect.com	+1 300 3250	distributor	retail-ready, verified-supplier, private-label, white-label, eco-friendly	Germany	1-2 weeks	Net 60	Multi-brand distributor. Same-day dispatch.	\N	500.00	\N	\N	\N	\N	\N	\N	0	\N
141	test-user-001	Omega Tools & Hardware Corp.	https://www.omegatoolshardwareco.com	feed	{}	active	2026-07-01 17:09:52.193025	t	verified	\N	\N	Wei Johnson	wei.johnson@omegatoolshardwarecorp.com	+81 500 8473	other	sample-available, white-label, MOQ-low, factory-direct, white-label	Germany	2-3 weeks	Western Union	Specialty supplier. Flexible terms.	\N	1000.00	\N	\N	\N	\N	\N	\N	0	\N
142	test-user-001	Atlas Fashion Trading Co.	https://www.atlasfashiontradingc.com	csv	{}	active	2026-07-01 17:09:52.193025	t	verified	\N	\N	Sarah Green	sarah.green@atlasfashiontradingco.com	+49 600 1178	wholesale	bulk-discount, MOQ-high, wholesale-only, factory-direct, MOQ-low, private-label	France	15-30 days	PayPal	Long-standing supplier with consistent quality.	\N	\N	\N	\N	\N	\N	\N	\N	0	\N
143	test-user-001	Zenith Home & Garden Company	https://www.zenithhomegardencomp.com	custom	{}	active	2026-07-01 17:09:52.193025	t	verified	\N	\N	Anna Garcia	anna.garcia@zenithhomegardencompany.com	+81 300 2144	wholesale	bulk-discount, MOQ-high, wholesale-only, factory-direct, wholesale-only, retail-ready	Indonesia	3-7 days	PayPal + Net 30	Factory-direct pricing. Samples available.	\N	50.00	\N	\N	\N	\N	\N	\N	0	\N
144	test-user-001	Premier Beauty & Personal Care Partners	https://www.premierbeautypersona.net	api	{}	active	2026-07-01 17:09:52.193025	t	verified	\N	\N	Patricia Yamamoto	patricia.yamamoto@premierbeautypersonalcarepartners.com	+81 200 6315	wholesale	bulk-discount, MOQ-high, wholesale-only, factory-direct, white-label, certified	India	7-10 days	Net 30	Long-standing supplier with consistent quality.	\N	1000.00	\N	\N	\N	\N	\N	\N	0	\N
145	test-user-001	Titan Lighting Sourcing	https://www.titanlightingsourcin.com	api	{}	active	2026-07-01 17:09:52.193025	t	verified	\N	\N	Susan Rivera	susan.rivera@titanlightingsourcing.com	+86 500 7688	wholesale	bulk-discount, MOQ-high, wholesale-only, factory-direct, certified, sample-available	Philippines	5-10 days	Letter of Credit	Bulk orders only. MOQ applies.	\N	200.00	\N	\N	\N	\N	\N	\N	0	\N
146	test-user-001	Nova Party Supplies Trading Co.	https://www.novapartysuppliestra.net	custom	{}	active	2026-07-01 17:09:52.193025	t	verified	\N	\N	Jeffrey Walker	jeffrey.walker@novapartysuppliestradingco.com	+44 700 3651	manufacturer	private-label, custom-packaging, certified, fast-shipping, MOQ-low, wholesale-only	Sri Lanka	3-5 days	Net 30	In-house design team. Custom packaging available.	\N	200.00	\N	\N	\N	\N	\N	\N	0	\N
147	test-user-001	Metro Fashion Limited	https://www.metrofashionlimited.com	custom	{}	active	2026-07-01 17:09:52.193025	t	verified	\N	\N	Lisa Park	lisa.park@metrofashionlimited.com	+49 600 3538	dropshipper	dropship-ready, fast-shipping, global-shipping, MOQ-low, sample-available, MOQ-low	Japan	3-5 days	PayPal	Automated dropshipping. No minimum order.	\N	200.00	\N	\N	\N	\N	\N	\N	0	\N
148	test-user-001	Summit Crafts & Sewing Partners	https://www.summitcraftssewingpa.net	feed	{}	active	2026-07-01 17:09:52.193025	t	verified	\N	\N	Lisa Tanaka	lisa.tanaka@summitcraftssewingpartners.com	+33 300 6200	other	sample-available, white-label, quality-assured, fast-shipping, white-label	South Korea	5-7 days	Net 90	Curated product selection. Personal account manager.	\N	\N	\N	\N	\N	\N	\N	\N	0	\N
149	test-user-001	Titan Stationery Direct	https://www.titanstationerydirec.org	custom	{}	active	2026-07-01 17:09:52.193025	t	verified	\N	\N	Liam Thomas	liam.thomas@titanstationerydirect.com	+33 500 1564	dropshipper	dropship-ready, fast-shipping, global-shipping, MOQ-low, sample-available, free-samples	Malaysia	5-7 days	T/T	Automated dropshipping. No minimum order.	\N	500.00	\N	\N	\N	\N	\N	\N	0	\N
150	test-user-001	Prime Watches Partners	https://www.primewatchespartners.net	feed	{}	active	2026-07-01 17:09:52.193025	t	verified	\N	\N	Deborah Choi	deborah.choi@primewatchespartners.com	+33 600 2263	distributor	retail-ready, verified-supplier, sample-available, verified-supplier, organic-certified	Philippines	15-30 days	Net 45	Authorized distributor for major brands.	\N	100.00	\N	\N	\N	\N	\N	\N	0	\N
151	test-user-001	Summit Home & Garden Holdings	https://www.summithomegardenhold.net	api	{}	active	2026-07-01 17:09:52.193025	t	verified	\N	\N	Lucas Wilson	lucas.wilson@summithomegardenholdings.com	+1 300 4822	other	sample-available, white-label, factory-direct, private-label, eco-friendly	UAE	3-7 days	Net 30	Curated product selection. Personal account manager.	\N	\N	\N	\N	\N	\N	\N	\N	0	\N
152	test-user-001	Zenith Camping & Hiking Supplies	https://www.zenithcampinghikings.com	csv	{}	active	2026-07-01 17:09:52.193025	t	verified	\N	\N	Isabella Allen	isabella.allen@zenithcampinghikingsupplies.com	+49 300 3065	wholesale	bulk-discount, MOQ-high, wholesale-only, factory-direct, retail-ready, dropship-ready	Turkey	14-21 days	Credit Card	Long-standing supplier with consistent quality.	\N	200.00	\N	\N	\N	\N	\N	\N	0	\N
153	test-user-001	Omega Camping & Hiking Sourcing	https://www.omegacampinghikingso.org	custom	{}	active	2026-07-01 17:09:52.193025	t	verified	\N	\N	Ethan Carter	ethan.carter@omegacampinghikingsourcing.com	+1 200 6179	dropshipper	dropship-ready, fast-shipping, global-shipping, MOQ-low, sample-available, fast-shipping	Vietnam	5-10 days	Net 45	Automated dropshipping. No minimum order.	\N	\N	\N	\N	\N	\N	\N	\N	0	\N
154	test-user-001	Nova Home & Garden International	https://www.novahomegardenintern.net	api	{}	active	2026-07-01 17:09:52.222735	t	verified	\N	\N	Gary Allen	gary.allen@novahomegardeninternational.com	+33 300 5143	dropshipper	dropship-ready, fast-shipping, global-shipping, MOQ-low, sample-available, MOQ-low	UK	7-12 days	PayPal	Worldwide shipping with tracking. Fulfillment within 24h.	\N	\N	\N	\N	\N	\N	\N	\N	0	\N
155	test-user-001	Supreme Stationery Partners	https://www.supremestationerypar.net	custom	{}	active	2026-07-01 17:09:52.222735	t	verified	\N	\N	James Lopez	james.lopez@supremestationerypartners.com	+91 200 9453	wholesale	bulk-discount, MOQ-high, wholesale-only, factory-direct, MOQ-low, free-samples	Indonesia	5-7 days	PayPal	Long-standing supplier with consistent quality.	\N	\N	\N	\N	\N	\N	\N	\N	0	\N
156	test-user-001	Omega Home & Garden Trading Co.	https://www.omegahomegardentradi.com	custom	{}	active	2026-07-01 17:09:52.222735	t	verified	\N	\N	Michael Anderson	michael.anderson@omegahomegardentradingco.com	+81 300 9525	wholesale	bulk-discount, MOQ-high, wholesale-only, factory-direct, fast-shipping, dropship-ready	USA	5-7 days	Wire Transfer	Long-standing supplier with consistent quality.	\N	100.00	\N	\N	\N	\N	\N	\N	0	\N
157	test-user-001	Metro Home Decor Limited	https://www.metrohomedecorlimite.com	custom	{}	active	2026-07-01 17:09:52.222735	t	verified	\N	\N	Thomas Liu	thomas.liu@metrohomedecorlimited.com	+86 200 2134	manufacturer	private-label, custom-packaging, certified, retail-ready, wholesale-only, free-samples	India	3-7 days	Net 45	In-house design team. Custom packaging available.	\N	50.00	\N	\N	\N	\N	\N	\N	0	\N
158	test-user-001	Premier Eyewear Holdings	https://www.premiereyewearholdin.com	csv	{}	active	2026-07-01 17:09:52.222735	t	verified	\N	\N	Sandra Nguyen	sandra.nguyen@premiereyewearholdings.com	+91 500 5862	wholesale	bulk-discount, MOQ-high, wholesale-only, factory-direct, fast-shipping, wholesale-only	Hong Kong	7-10 days	Credit Card	Bulk orders only. MOQ applies.	\N	\N	\N	\N	\N	\N	\N	\N	0	\N
159	test-user-001	Apex Home & Garden Limited	https://www.apexhomegardenlimite.org	api	{}	active	2026-07-01 17:09:52.222735	t	verified	\N	\N	Mark Johnson	mark.johnson@apexhomegardenlimited.com	+81 600 3230	manufacturer	private-label, custom-packaging, certified, custom-packaging, verified-supplier, premium	Portugal	7-12 days	Net 60	Full OEM/ODM capabilities. ISO certified.	\N	1000.00	\N	\N	\N	\N	\N	\N	0	\N
160	test-user-001	Pacific Home & Garden Industries	https://www.pacifichomegardenind.org	feed	{}	active	2026-07-01 17:09:52.222735	t	verified	\N	\N	Joseph Jones	joseph.jones@pacifichomegardenindustries.com	+33 500 6404	dropshipper	dropship-ready, fast-shipping, global-shipping, MOQ-low, sample-available, free-samples	France	1-2 weeks	T/T	Automated dropshipping. No minimum order.	\N	1000.00	\N	\N	\N	\N	\N	\N	0	\N
161	test-user-001	Metro Office Products Supplies	https://www.metroofficeproductss.net	api	{}	active	2026-07-01 17:09:52.222735	t	verified	\N	\N	Satoshi Collins	satoshi.collins@metroofficeproductssupplies.com	+81 300 4617	manufacturer	private-label, custom-packaging, certified, free-samples, sample-available, verified-supplier	Italy	2-3 weeks	Letter of Credit	In-house design team. Custom packaging available.	\N	500.00	\N	\N	\N	\N	\N	\N	0	\N
162	test-user-001	Metro Stationery Inc.	https://www.metrostationeryinc.com	api	{}	active	2026-07-01 17:09:52.222735	t	verified	\N	\N	John Turner	john.turner@metrostationeryinc.com	+1 500 3483	manufacturer	private-label, custom-packaging, certified, fast-shipping, white-label, global-shipping	Netherlands	3-7 days	PayPal + Net 30	Full OEM/ODM capabilities. ISO certified.	\N	100.00	\N	\N	\N	\N	\N	\N	0	\N
163	test-user-001	Apex Office Products Sourcing	https://www.apexofficeproductsso.net	csv	{}	active	2026-07-01 17:09:52.222735	t	verified	\N	\N	Andrew Wilson	andrew.wilson@apexofficeproductssourcing.com	+49 300 5890	wholesale	bulk-discount, MOQ-high, wholesale-only, factory-direct, free-samples, dropship-ready	Pakistan	15-30 days	Net 60	Bulk orders only. MOQ applies.	\N	50.00	\N	\N	\N	\N	\N	\N	0	\N
164	test-user-001	Delta Jewelry & Accessories Solutions	https://www.deltajewelryaccessor.net	csv	{}	active	2026-07-01 17:09:52.222735	t	verified	\N	\N	Matthew Cruz	matthew.cruz@deltajewelryaccessoriessolutions.com	+1 400 9369	wholesale	bulk-discount, MOQ-high, wholesale-only, factory-direct, fast-shipping, eco-friendly	Hong Kong	15-30 days	Net 30	Factory-direct pricing. Samples available.	\N	50.00	\N	\N	\N	\N	\N	\N	0	\N
165	test-user-001	Pacific Bags & Luggage Group	https://www.pacificbagsluggagegr.com	csv	{}	active	2026-07-01 17:09:52.222735	t	verified	\N	\N	Mark Hernandez	mark.hernandez@pacificbagsluggagegroup.com	+1 500 7779	wholesale	bulk-discount, MOQ-high, wholesale-only, factory-direct, organic-certified, factory-direct	Taiwan	1-2 weeks	Wire Transfer	Factory-direct pricing. Samples available.	\N	1000.00	\N	\N	\N	\N	\N	\N	0	\N
166	test-user-001	Atlas Office Products Partners	https://www.atlasofficeproductsp.org	csv	{}	active	2026-07-01 17:09:52.222735	t	verified	\N	\N	Sharon Adams	sharon.adams@atlasofficeproductspartners.com	+33 700 4331	manufacturer	private-label, custom-packaging, certified, custom-packaging, premium, organic-certified	Mexico	3-5 days	Western Union	In-house design team. Custom packaging available.	\N	50.00	\N	\N	\N	\N	\N	\N	0	\N
167	test-user-001	Alpha Baby Products Direct	https://www.alphababyproductsdir.com	custom	{}	active	2026-07-01 17:09:52.222735	t	verified	\N	\N	Brian Yamamoto	brian.yamamoto@alphababyproductsdirect.com	+86 600 9601	other	sample-available, white-label, sample-available, white-label, factory-direct	France	3-7 days	Credit Card	Specialty supplier. Flexible terms.	\N	\N	\N	\N	\N	\N	\N	\N	0	\N
168	test-user-001	Atlas Health & Wellness Inc.	https://www.atlashealthwellnessi.net	feed	{}	active	2026-07-01 17:09:52.222735	t	verified	\N	\N	Karen Nelson	karen.nelson@atlashealthwellnessinc.com	+91 400 2988	dropshipper	dropship-ready, fast-shipping, global-shipping, MOQ-low, sample-available, eco-friendly	Turkey	1-2 weeks	T/T	Automated dropshipping. No minimum order.	\N	500.00	\N	\N	\N	\N	\N	\N	0	\N
169	test-user-001	Omega Crafts & Sewing Trading Co.	https://www.omegacraftssewingtra.com	feed	{}	active	2026-07-01 17:09:52.222735	t	verified	\N	\N	Fatima Davis	fatima.davis@omegacraftssewingtradingco.com	+33 700 9479	wholesale	bulk-discount, MOQ-high, wholesale-only, factory-direct, eco-friendly, bulk-discount	Canada	2-3 weeks	PayPal + Net 30	Bulk orders only. MOQ applies.	\N	50.00	\N	\N	\N	\N	\N	\N	0	\N
170	test-user-001	Titan Furniture Inc.	https://www.titanfurnitureinc.com	custom	{}	active	2026-07-01 17:09:52.222735	t	verified	\N	\N	Mason Singh	mason.singh@titanfurnitureinc.com	+49 600 2120	distributor	retail-ready, verified-supplier, free-samples, sample-available, bulk-discount	Philippines	10-15 days	Net 60	Multi-brand distributor. Same-day dispatch.	\N	50.00	\N	\N	\N	\N	\N	\N	0	\N
171	test-user-001	Global Office Products Company	https://www.globalofficeproducts.com	feed	{}	active	2026-07-01 17:09:52.222735	t	verified	\N	\N	Xia Nguyen	xia.nguyen@globalofficeproductscompany.com	+33 200 1787	dropshipper	dropship-ready, fast-shipping, global-shipping, MOQ-low, sample-available, MOQ-low	India	14-21 days	PayPal + Net 30	Worldwide shipping with tracking. Fulfillment within 24h.	\N	1000.00	\N	\N	\N	\N	\N	\N	0	\N
172	test-user-001	Pacific Party Supplies Sourcing	https://www.pacificpartysupplies.net	csv	{}	active	2026-07-01 17:09:52.222735	t	verified	\N	\N	Rebecca Evans	rebecca.evans@pacificpartysuppliessourcing.com	+49 500 3944	dropshipper	dropship-ready, fast-shipping, global-shipping, MOQ-low, sample-available, wholesale-only	Turkey	7-12 days	Net 60	Automated dropshipping. No minimum order.	\N	\N	\N	\N	\N	\N	\N	\N	0	\N
173	test-user-001	Metro Bags & Luggage Supplies	https://www.metrobagsluggagesupp.org	feed	{}	active	2026-07-01 17:09:52.222735	t	verified	\N	\N	Rebecca Campbell	rebecca.campbell@metrobagsluggagesupplies.com	+33 500 1710	dropshipper	dropship-ready, fast-shipping, global-shipping, MOQ-low, sample-available, private-label	Singapore	7-12 days	PayPal	Automated dropshipping. No minimum order.	\N	200.00	\N	\N	\N	\N	\N	\N	0	\N
174	test-user-001	Supreme Tools & Hardware Company	https://www.supremetoolshardware.com	feed	{}	active	2026-07-01 17:09:52.222735	t	verified	\N	\N	Chen Lopez	chen.lopez@supremetoolshardwarecompany.com	+49 500 2461	dropshipper	dropship-ready, fast-shipping, global-shipping, MOQ-low, sample-available, verified-supplier	Turkey	1-2 weeks	PayPal	Worldwide shipping with tracking. Fulfillment within 24h.	\N	200.00	\N	\N	\N	\N	\N	\N	0	\N
175	test-user-001	Global Automotive Direct	https://www.globalautomotivedire.com	custom	{}	active	2026-07-01 17:09:52.222735	t	verified	\N	\N	Sophia Campbell	sophia.campbell@globalautomotivedirect.com	+86 300 5657	wholesale	bulk-discount, MOQ-high, wholesale-only, factory-direct, retail-ready, bulk-discount	UAE	2-3 weeks	Net 30	Bulk orders only. MOQ applies.	\N	100.00	\N	\N	\N	\N	\N	\N	0	\N
176	test-user-001	Apex Clothing Enterprise	https://www.apexclothingenterpri.com	feed	{}	active	2026-07-01 17:09:52.222735	t	verified	\N	\N	Fatima Lewis	fatima.lewis@apexclothingenterprise.com	+91 600 8226	manufacturer	private-label, custom-packaging, certified, quality-assured, certified, white-label	Pakistan	7-14 days	PayPal + Net 30	Full OEM/ODM capabilities. ISO certified.	\N	200.00	\N	\N	\N	\N	\N	\N	0	\N
177	test-user-001	Summit Baby Products Trading Co.	https://www.summitbabyproductstr.net	feed	{}	active	2026-07-01 17:09:52.222735	t	verified	\N	\N	Anna Moore	anna.moore@summitbabyproductstradingco.com	+33 200 3758	wholesale	bulk-discount, MOQ-high, wholesale-only, factory-direct, eco-friendly, wholesale-only	Australia	7-14 days	Credit Card	Factory-direct pricing. Samples available.	\N	500.00	\N	\N	\N	\N	\N	\N	0	\N
178	test-user-001	Supreme Health & Wellness Sourcing	https://www.supremehealthwellnes.net	api	{}	active	2026-07-01 17:09:52.222735	t	verified	\N	\N	Robert Singh	robert.singh@supremehealthwellnesssourcing.com	+44 600 2872	manufacturer	private-label, custom-packaging, certified, fast-shipping, dropship-ready, factory-direct	Japan	5-7 days	Western Union	In-house design team. Custom packaging available.	\N	50.00	\N	\N	\N	\N	\N	\N	0	\N
179	test-user-001	Zenith Stationery Company	https://www.zenithstationerycomp.net	csv	{}	active	2026-07-01 17:09:52.222735	t	verified	\N	\N	Laura Young	laura.young@zenithstationerycompany.com	+49 200 4749	manufacturer	private-label, custom-packaging, certified, private-label, bulk-discount, free-samples	Mexico	14-21 days	Western Union	In-house design team. Custom packaging available.	\N	50.00	\N	\N	\N	\N	\N	\N	0	\N
180	test-user-001	Peak Party Supplies Solutions	https://www.peakpartysuppliessol.net	feed	{}	active	2026-07-01 17:09:52.222735	t	verified	\N	\N	Anna Walker	anna.walker@peakpartysuppliessolutions.com	+44 200 4475	manufacturer	private-label, custom-packaging, certified, MOQ-high, organic-certified, factory-direct	Vietnam	2-3 weeks	Letter of Credit	In-house design team. Custom packaging available.	\N	500.00	\N	\N	\N	\N	\N	\N	0	\N
181	test-user-001	Titan Office Products Solutions	https://www.titanofficeproductss.com	csv	{}	active	2026-07-01 17:09:52.222735	t	verified	\N	\N	Joseph Rivera	joseph.rivera@titanofficeproductssolutions.com	+44 700 5417	dropshipper	dropship-ready, fast-shipping, global-shipping, MOQ-low, sample-available, global-shipping	Portugal	10-15 days	Net 45	Automated dropshipping. No minimum order.	\N	200.00	\N	\N	\N	\N	\N	\N	0	\N
222	test-user-001	Royal Baby Products Direct	https://www.royalbabyproductsdir.org	feed	{}	active	2026-07-01 17:09:52.234084	t	verified	\N	\N	Liam Jones	liam.jones@royalbabyproductsdirect.com	+44 700 6754	distributor	retail-ready, verified-supplier, free-samples, verified-supplier, premium	UAE	7-10 days	Credit Card	Authorized distributor for major brands.	\N	1000.00	\N	\N	\N	\N	\N	\N	0	\N
182	test-user-001	Universal Clothing Enterprise	https://www.universalclothingent.org	feed	{}	active	2026-07-01 17:09:52.222735	t	verified	\N	\N	Sarah Martinez	sarah.martinez@universalclothingenterprise.com	+49 200 3419	manufacturer	private-label, custom-packaging, certified, bulk-discount, MOQ-high, quality-assured	Spain	10-15 days	Net 90	In-house design team. Custom packaging available.	\N	\N	\N	\N	\N	\N	\N	\N	0	\N
183	test-user-001	Nova Office Products Holdings	https://www.novaofficeproductsho.com	api	{}	active	2026-07-01 17:09:52.222735	t	verified	\N	\N	Ahmed Patel	ahmed.patel@novaofficeproductsholdings.com	+1 200 5306	distributor	retail-ready, verified-supplier, MOQ-high, eco-friendly, free-samples	UAE	5-7 days	Net 30	Authorized distributor for major brands.	\N	200.00	\N	\N	\N	\N	\N	\N	0	\N
184	test-user-001	Vertex Office Products Group	https://www.vertexofficeproducts.com	custom	{}	active	2026-07-01 17:09:52.222735	t	verified	\N	\N	Cynthia Baker	cynthia.baker@vertexofficeproductsgroup.com	+81 700 1413	other	sample-available, white-label, premium, factory-direct, global-shipping	UAE	3-5 days	T/T	Curated product selection. Personal account manager.	\N	1000.00	\N	\N	\N	\N	\N	\N	0	\N
185	test-user-001	Apex Baby Products Enterprise	https://www.apexbabyproductsente.org	csv	{}	active	2026-07-01 17:09:52.222735	t	verified	\N	\N	Lisa Nelson	lisa.nelson@apexbabyproductsenterprise.com	+1 500 2590	other	sample-available, white-label, global-shipping, bulk-discount, private-label	Vietnam	5-10 days	Net 45	Curated product selection. Personal account manager.	\N	500.00	\N	\N	\N	\N	\N	\N	0	\N
186	test-user-001	Titan Clothing Supplies	https://www.titanclothingsupplie.org	custom	{}	active	2026-07-01 17:09:52.222735	t	verified	\N	\N	Amy Garcia	amy.garcia@titanclothingsupplies.com	+49 400 7570	manufacturer	private-label, custom-packaging, certified, MOQ-low, MOQ-high, eco-friendly	Canada	10-15 days	Net 15	Full OEM/ODM capabilities. ISO certified.	\N	50.00	\N	\N	\N	\N	\N	\N	0	\N
187	test-user-001	Pacific Kitchen & Dining Supplies	https://www.pacifickitchendining.net	feed	{}	active	2026-07-01 17:09:52.222735	t	verified	\N	\N	Dorothy Wang	dorothy.wang@pacifickitchendiningsupplies.com	+49 500 6995	other	sample-available, white-label, verified-supplier, MOQ-high, white-label	Portugal	15-30 days	Wire Transfer	Specialty supplier. Flexible terms.	\N	100.00	\N	\N	\N	\N	\N	\N	0	\N
188	test-user-001	Atlas Clothing International	https://www.atlasclothinginterna.net	csv	{}	active	2026-07-01 17:09:52.222735	t	verified	\N	\N	William Torres	william.torres@atlasclothinginternational.com	+1 400 7284	distributor	retail-ready, verified-supplier, fast-shipping, dropship-ready, white-label	Taiwan	2-3 weeks	Net 45	Multi-brand distributor. Same-day dispatch.	\N	\N	\N	\N	\N	\N	\N	\N	0	\N
189	test-user-001	Royal Automotive Corp.	https://www.royalautomotivecorp.net	csv	{}	active	2026-07-01 17:09:52.222735	t	verified	\N	\N	Min Martin	min.martin@royalautomotivecorp.com	+86 700 6240	wholesale	bulk-discount, MOQ-high, wholesale-only, factory-direct, factory-direct, custom-packaging	Vietnam	5-7 days	PayPal + Net 30	Long-standing supplier with consistent quality.	\N	\N	\N	\N	\N	\N	\N	\N	0	\N
190	test-user-001	Universal Party Supplies Partners	https://www.universalpartysuppli.com	csv	{}	active	2026-07-01 17:09:52.222735	t	verified	\N	\N	Min Zhang	min.zhang@universalpartysuppliespartners.com	+86 600 9437	dropshipper	dropship-ready, fast-shipping, global-shipping, MOQ-low, sample-available, dropship-ready	Sri Lanka	15-30 days	Net 15	Automated dropshipping. No minimum order.	\N	200.00	\N	\N	\N	\N	\N	\N	0	\N
191	test-user-001	Omega Health & Wellness Limited	https://www.omegahealthwellnessl.com	custom	{}	active	2026-07-01 17:09:52.222735	t	verified	\N	\N	Helen Baker	helen.baker@omegahealthwellnesslimited.com	+49 600 1056	manufacturer	private-label, custom-packaging, certified, free-samples, wholesale-only, organic-certified	Indonesia	7-12 days	Net 90	Full OEM/ODM capabilities. ISO certified.	\N	100.00	\N	\N	\N	\N	\N	\N	0	\N
192	test-user-001	Peak Office Products Direct	https://www.peakofficeproductsdi.org	api	{}	active	2026-07-01 17:09:52.222735	t	verified	\N	\N	Raj King	raj.king@peakofficeproductsdirect.com	+44 200 7578	dropshipper	dropship-ready, fast-shipping, global-shipping, MOQ-low, sample-available, premium	Indonesia	5-7 days	Wire Transfer	Automated dropshipping. No minimum order.	\N	\N	\N	\N	\N	\N	\N	\N	0	\N
193	test-user-001	Universal Tools & Hardware Enterprise	https://www.universaltoolshardwa.org	custom	{}	active	2026-07-01 17:09:52.222735	t	verified	\N	\N	Jacob Rodriguez	jacob.rodriguez@universaltoolshardwareenterprise.com	+91 600 6464	dropshipper	dropship-ready, fast-shipping, global-shipping, MOQ-low, sample-available, eco-friendly	Bangladesh	7-12 days	Wire Transfer	Worldwide shipping with tracking. Fulfillment within 24h.	\N	200.00	\N	\N	\N	\N	\N	\N	0	\N
194	test-user-001	Royal Beauty & Personal Care Supplies	https://www.royalbeautypersonalc.org	custom	{}	active	2026-07-01 17:09:52.222735	t	verified	\N	\N	Mason Taylor	mason.taylor@royalbeautypersonalcaresupplies.com	+86 700 1316	wholesale	bulk-discount, MOQ-high, wholesale-only, factory-direct, global-shipping, certified	Canada	10-15 days	Net 30	Long-standing supplier with consistent quality.	\N	100.00	\N	\N	\N	\N	\N	\N	0	\N
195	test-user-001	Prime Clothing Company	https://www.primeclothingcompany.com	api	{}	active	2026-07-01 17:09:52.222735	t	verified	\N	\N	William Tanaka	william.tanaka@primeclothingcompany.com	+49 200 6599	dropshipper	dropship-ready, fast-shipping, global-shipping, MOQ-low, sample-available, bulk-discount	UK	5-7 days	Net 60	Automated dropshipping. No minimum order.	\N	100.00	\N	\N	\N	\N	\N	\N	0	\N
196	test-user-001	Nova Bags & Luggage Holdings	https://www.novabagsluggageholdi.org	feed	{}	active	2026-07-01 17:09:52.222735	t	verified	\N	\N	Maria Chen	maria.chen@novabagsluggageholdings.com	+1 400 8316	distributor	retail-ready, verified-supplier, fast-shipping, dropship-ready, verified-supplier	Italy	14-21 days	PayPal + Net 30	Multi-brand distributor. Same-day dispatch.	\N	500.00	\N	\N	\N	\N	\N	\N	0	\N
197	test-user-001	Peak Bags & Luggage Corp.	https://www.peakbagsluggagecorp.net	csv	{}	active	2026-07-01 17:09:52.222735	t	verified	\N	\N	Min Clark	min.clark@peakbagsluggagecorp.com	+1 400 5554	distributor	retail-ready, verified-supplier, wholesale-only, dropship-ready, custom-packaging	Canada	1-2 weeks	Net 60	Authorized distributor for major brands.	\N	50.00	\N	\N	\N	\N	\N	\N	0	\N
198	test-user-001	Apex Health & Wellness International	https://www.apexhealthwellnessin.org	feed	{}	active	2026-07-01 17:09:52.222735	t	verified	\N	\N	Satoshi Hill	satoshi.hill@apexhealthwellnessinternational.com	+86 500 9392	dropshipper	dropship-ready, fast-shipping, global-shipping, MOQ-low, sample-available, bulk-discount	Hong Kong	5-10 days	Western Union	Worldwide shipping with tracking. Fulfillment within 24h.	\N	\N	\N	\N	\N	\N	\N	\N	0	\N
199	test-user-001	Elite Clothing Company	https://www.eliteclothingcompany.com	custom	{}	active	2026-07-01 17:09:52.222735	t	verified	\N	\N	Isabella Park	isabella.park@eliteclothingcompany.com	+49 400 7879	wholesale	bulk-discount, MOQ-high, wholesale-only, factory-direct, bulk-discount, private-label	Philippines	3-7 days	PayPal	Bulk orders only. MOQ applies.	\N	50.00	\N	\N	\N	\N	\N	\N	0	\N
200	test-user-001	Metro Eyewear Partners	https://www.metroeyewearpartners.net	csv	{}	active	2026-07-01 17:09:52.222735	t	verified	\N	\N	Angela Smith	angela.smith@metroeyewearpartners.com	+81 200 8698	dropshipper	dropship-ready, fast-shipping, global-shipping, MOQ-low, sample-available, premium	Brazil	7-10 days	PayPal + Net 30	Automated dropshipping. No minimum order.	\N	1000.00	\N	\N	\N	\N	\N	\N	0	\N
201	test-user-001	Vertex Health & Wellness Sourcing	https://www.vertexhealthwellness.org	api	{}	active	2026-07-01 17:09:52.222735	t	verified	\N	\N	Elizabeth Garcia	elizabeth.garcia@vertexhealthwellnesssourcing.com	+86 500 2084	distributor	retail-ready, verified-supplier, premium, retail-ready, eco-friendly	USA	5-10 days	Letter of Credit	Multi-brand distributor. Same-day dispatch.	\N	\N	\N	\N	\N	\N	\N	\N	0	\N
202	test-user-001	Delta Fashion Group	https://www.deltafashiongroup.org	feed	{}	active	2026-07-01 17:09:52.222735	t	verified	\N	\N	Michelle Yamamoto	michelle.yamamoto@deltafashiongroup.com	+33 700 1169	manufacturer	private-label, custom-packaging, certified, certified, bulk-discount, MOQ-low	Spain	14-21 days	Net 45	In-house design team. Custom packaging available.	\N	200.00	\N	\N	\N	\N	\N	\N	0	\N
203	test-user-001	Alpha Tools & Hardware Company	https://www.alphatoolshardwareco.com	api	{}	active	2026-07-01 17:09:52.222735	t	verified	\N	\N	Brian Jackson	brian.jackson@alphatoolshardwarecompany.com	+49 400 4122	dropshipper	dropship-ready, fast-shipping, global-shipping, MOQ-low, sample-available, private-label	Vietnam	5-7 days	Net 45	Automated dropshipping. No minimum order.	\N	\N	\N	\N	\N	\N	\N	\N	0	\N
204	test-user-001	Royal Home & Garden Direct	https://www.royalhomegardendirec.net	custom	{}	active	2026-07-01 17:09:52.234084	t	verified	\N	\N	Sarah Phillips	sarah.phillips@royalhomegardendirect.com	+81 400 9614	wholesale	bulk-discount, MOQ-high, wholesale-only, factory-direct, certified, white-label	Germany	14-21 days	Western Union	Bulk orders only. MOQ applies.	\N	500.00	\N	\N	\N	\N	\N	\N	0	\N
205	test-user-001	Peak Home & Garden Company	https://www.peakhomegardencompan.com	api	{}	active	2026-07-01 17:09:52.234084	t	verified	\N	\N	Raj Young	raj.young@peakhomegardencompany.com	+33 300 8293	manufacturer	private-label, custom-packaging, certified, white-label, free-samples, fast-shipping	Pakistan	14-21 days	PayPal + Net 30	In-house design team. Custom packaging available.	\N	100.00	\N	\N	\N	\N	\N	\N	0	\N
206	test-user-001	Zenith Fashion Inc.	https://www.zenithfashioninc.org	csv	{}	active	2026-07-01 17:09:52.234084	t	verified	\N	\N	Mary Tanaka	mary.tanaka@zenithfashioninc.com	+33 600 5342	dropshipper	dropship-ready, fast-shipping, global-shipping, MOQ-low, sample-available, quality-assured	Thailand	3-5 days	Net 45	Automated dropshipping. No minimum order.	\N	1000.00	\N	\N	\N	\N	\N	\N	0	\N
207	test-user-001	Elite Jewelry & Accessories Trading Co.	https://www.elitejewelryaccessor.com	feed	{}	active	2026-07-01 17:09:52.234084	t	verified	\N	\N	Yuki Phillips	yuki.phillips@elitejewelryaccessoriestradingco.com	+1 700 4022	other	sample-available, white-label, bulk-discount, wholesale-only, eco-friendly	Sri Lanka	5-7 days	Net 45	Specialty supplier. Flexible terms.	\N	100.00	\N	\N	\N	\N	\N	\N	0	\N
208	test-user-001	Titan Fashion Inc.	https://www.titanfashioninc.com	csv	{}	active	2026-07-01 17:09:52.234084	t	verified	\N	\N	Richard Liu	richard.liu@titanfashioninc.com	+91 300 2135	wholesale	bulk-discount, MOQ-high, wholesale-only, factory-direct, fast-shipping, verified-supplier	Netherlands	3-5 days	Net 60	Factory-direct pricing. Samples available.	\N	50.00	\N	\N	\N	\N	\N	\N	0	\N
209	test-user-001	Summit Shoes Corp.	https://www.summitshoescorp.com	feed	{}	active	2026-07-01 17:09:52.234084	t	verified	\N	\N	Linda Choi	linda.choi@summitshoescorp.com	+91 500 7348	distributor	retail-ready, verified-supplier, certified, fast-shipping, verified-supplier	Thailand	7-10 days	Net 30	Multi-brand distributor. Same-day dispatch.	\N	50.00	\N	\N	\N	\N	\N	\N	0	\N
210	test-user-001	Global Bags & Luggage Trading Co.	https://www.globalbagsluggagetra.com	feed	{}	active	2026-07-01 17:09:52.234084	t	verified	\N	\N	Ahmed Robinson	ahmed.robinson@globalbagsluggagetradingco.com	+81 200 8924	manufacturer	private-label, custom-packaging, certified, organic-certified, private-label, factory-direct	Thailand	3-5 days	Western Union	In-house design team. Custom packaging available.	\N	\N	\N	\N	\N	\N	\N	\N	0	\N
211	test-user-001	Titan Home & Garden Solutions	https://www.titanhomegardensolut.net	feed	{}	active	2026-07-01 17:09:52.234084	t	verified	\N	\N	George White	george.white@titanhomegardensolutions.com	+86 300 6083	other	sample-available, white-label, white-label, MOQ-high, premium	Brazil	3-5 days	Net 45	Specialty supplier. Flexible terms.	\N	\N	\N	\N	\N	\N	\N	\N	0	\N
212	test-user-001	Zenith Eyewear Holdings	https://www.zenitheyewearholding.net	custom	{}	active	2026-07-01 17:09:52.234084	t	verified	\N	\N	Noah Edwards	noah.edwards@zenitheyewearholdings.com	+81 700 8627	manufacturer	private-label, custom-packaging, certified, fast-shipping, dropship-ready, global-shipping	Thailand	14-21 days	T/T	Full OEM/ODM capabilities. ISO certified.	\N	\N	\N	\N	\N	\N	\N	\N	0	\N
213	test-user-001	Universal Baby Products Supplies	https://www.universalbabyproduct.net	csv	{}	active	2026-07-01 17:09:52.234084	t	verified	\N	\N	Anna Thomas	anna.thomas@universalbabyproductssupplies.com	+91 300 8989	wholesale	bulk-discount, MOQ-high, wholesale-only, factory-direct, MOQ-low, bulk-discount	Italy	5-10 days	PayPal + Net 30	Factory-direct pricing. Samples available.	\N	1000.00	\N	\N	\N	\N	\N	\N	0	\N
214	test-user-001	Titan Crafts & Sewing Corp.	https://www.titancraftssewingcor.com	api	{}	active	2026-07-01 17:09:52.234084	t	verified	\N	\N	Donald Moore	donald.moore@titancraftssewingcorp.com	+86 400 5788	manufacturer	private-label, custom-packaging, certified, fast-shipping, organic-certified, retail-ready	France	7-14 days	Net 15	Full OEM/ODM capabilities. ISO certified.	\N	500.00	\N	\N	\N	\N	\N	\N	0	\N
215	test-user-001	Global Home & Garden Direct	https://www.globalhomegardendire.org	feed	{}	active	2026-07-01 17:09:52.234084	t	verified	\N	\N	Elizabeth Davis	elizabeth.davis@globalhomegardendirect.com	+49 600 8537	other	sample-available, white-label, MOQ-low, verified-supplier, wholesale-only	Thailand	5-10 days	PayPal + Net 30	Curated product selection. Personal account manager.	\N	200.00	\N	\N	\N	\N	\N	\N	0	\N
216	test-user-001	Delta Automotive Industries	https://www.deltaautomotiveindus.com	feed	{}	active	2026-07-01 17:09:52.234084	t	verified	\N	\N	Helen Torres	helen.torres@deltaautomotiveindustries.com	+44 400 7034	other	sample-available, white-label, premium, quality-assured, certified	Pakistan	7-12 days	Letter of Credit	Curated product selection. Personal account manager.	\N	100.00	\N	\N	\N	\N	\N	\N	0	\N
217	test-user-001	Premier Camping & Hiking Holdings	https://www.premiercampinghiking.com	feed	{}	active	2026-07-01 17:09:52.234084	t	verified	\N	\N	Ahmed Walker	ahmed.walker@premiercampinghikingholdings.com	+49 300 3225	manufacturer	private-label, custom-packaging, certified, global-shipping, free-samples, factory-direct	Portugal	10-15 days	Net 15	In-house design team. Custom packaging available.	\N	\N	\N	\N	\N	\N	\N	\N	0	\N
218	test-user-001	Supreme Kitchen & Dining Sourcing	https://www.supremekitchendining.org	custom	{}	active	2026-07-01 17:09:52.234084	t	verified	\N	\N	Priya Yang	priya.yang@supremekitchendiningsourcing.com	+91 600 1924	wholesale	bulk-discount, MOQ-high, wholesale-only, factory-direct, verified-supplier, free-samples	Turkey	3-5 days	Net 15	Factory-direct pricing. Samples available.	\N	100.00	\N	\N	\N	\N	\N	\N	0	\N
219	test-user-001	Global Clothing International	https://www.globalclothingintern.com	feed	{}	active	2026-07-01 17:09:52.234084	t	verified	\N	\N	Margaret Adams	margaret.adams@globalclothinginternational.com	+81 600 4349	manufacturer	private-label, custom-packaging, certified, wholesale-only, sample-available, custom-packaging	Pakistan	1-2 weeks	Wire Transfer	Full OEM/ODM capabilities. ISO certified.	\N	500.00	\N	\N	\N	\N	\N	\N	0	\N
220	test-user-001	Universal Beauty & Personal Care Direct	https://www.universalbeautyperso.org	feed	{}	active	2026-07-01 17:09:52.234084	t	verified	\N	\N	Sarah Hall	sarah.hall@universalbeautypersonalcaredirect.com	+91 200 4751	distributor	retail-ready, verified-supplier, MOQ-low, verified-supplier, global-shipping	South Korea	1-2 weeks	Credit Card	Multi-brand distributor. Same-day dispatch.	\N	200.00	\N	\N	\N	\N	\N	\N	0	\N
221	test-user-001	Omega Eyewear Limited	https://www.omegaeyewearlimited.com	feed	{}	active	2026-07-01 17:09:52.234084	t	verified	\N	\N	Sharon Wright	sharon.wright@omegaeyewearlimited.com	+86 600 9553	dropshipper	dropship-ready, fast-shipping, global-shipping, MOQ-low, sample-available, free-samples	Bangladesh	10-15 days	Net 60	Automated dropshipping. No minimum order.	\N	\N	\N	\N	\N	\N	\N	\N	0	\N
223	test-user-001	Royal Clothing International	https://www.royalclothinginterna.net	custom	{}	active	2026-07-01 17:09:52.234084	t	verified	\N	\N	Dorothy Wang	dorothy.wang@royalclothinginternational.com	+81 400 6106	distributor	retail-ready, verified-supplier, factory-direct, free-samples, MOQ-low	Turkey	3-7 days	Letter of Credit	Multi-brand distributor. Same-day dispatch.	\N	\N	\N	\N	\N	\N	\N	\N	0	\N
224	test-user-001	Global Beauty & Personal Care Partners	https://www.globalbeautypersonal.com	feed	{}	active	2026-07-01 17:09:52.234084	t	verified	\N	\N	Margaret Choi	margaret.choi@globalbeautypersonalcarepartners.com	+81 700 3960	wholesale	bulk-discount, MOQ-high, wholesale-only, factory-direct, MOQ-high, sample-available	Pakistan	7-10 days	Wire Transfer	Bulk orders only. MOQ applies.	\N	200.00	\N	\N	\N	\N	\N	\N	0	\N
225	test-user-001	Premier Clothing Group	https://www.premierclothinggroup.net	custom	{}	active	2026-07-01 17:09:52.234084	t	verified	\N	\N	Raj Gonzalez	raj.gonzalez@premierclothinggroup.com	+86 400 7484	other	sample-available, white-label, white-label, free-samples, MOQ-low	Philippines	7-10 days	Net 60	Curated product selection. Personal account manager.	\N	\N	\N	\N	\N	\N	\N	\N	0	\N
226	test-user-001	Summit Stationery Limited	https://www.summitstationerylimi.net	custom	{}	active	2026-07-01 17:09:52.234084	t	verified	\N	\N	Jacob Nelson	jacob.nelson@summitstationerylimited.com	+33 400 1648	manufacturer	private-label, custom-packaging, certified, certified, white-label, free-samples	Hong Kong	2-3 weeks	PayPal	Full OEM/ODM capabilities. ISO certified.	\N	500.00	\N	\N	\N	\N	\N	\N	0	\N
227	test-user-001	Pacific Office Products Sourcing	https://www.pacificofficeproduct.com	csv	{}	active	2026-07-01 17:09:52.234084	t	verified	\N	\N	Nancy Moore	nancy.moore@pacificofficeproductssourcing.com	+33 400 5412	manufacturer	private-label, custom-packaging, certified, bulk-discount, fast-shipping, factory-direct	Spain	5-10 days	Western Union	In-house design team. Custom packaging available.	\N	100.00	\N	\N	\N	\N	\N	\N	0	\N
228	test-user-001	Summit Tools & Hardware Supplies	https://www.summittoolshardwares.org	custom	{}	active	2026-07-01 17:09:52.234084	t	verified	\N	\N	Brian Wright	brian.wright@summittoolshardwaresupplies.com	+1 400 4812	other	sample-available, white-label, global-shipping, factory-direct, fast-shipping	Singapore	1-2 weeks	Letter of Credit	Specialty supplier. Flexible terms.	\N	200.00	\N	\N	\N	\N	\N	\N	0	\N
229	test-user-001	Vertex Watches Holdings	https://www.vertexwatchesholding.org	custom	{}	active	2026-07-01 17:09:52.234084	t	verified	\N	\N	John Garcia	john.garcia@vertexwatchesholdings.com	+1 500 7061	wholesale	bulk-discount, MOQ-high, wholesale-only, factory-direct, fast-shipping, dropship-ready	Philippines	7-10 days	PayPal	Factory-direct pricing. Samples available.	\N	1000.00	\N	\N	\N	\N	\N	\N	0	\N
230	test-user-001	Summit Camping & Hiking Company	https://www.summitcampinghikingc.com	csv	{}	active	2026-07-01 17:09:52.234084	t	verified	\N	\N	Rebecca Miller	rebecca.miller@summitcampinghikingcompany.com	+86 300 8805	manufacturer	private-label, custom-packaging, certified, wholesale-only, white-label, dropship-ready	UK	7-14 days	Net 45	In-house design team. Custom packaging available.	\N	1000.00	\N	\N	\N	\N	\N	\N	0	\N
231	test-user-001	Atlas Home & Garden Solutions	https://www.atlashomegardensolut.org	api	{}	active	2026-07-01 17:09:52.234084	t	verified	\N	\N	Joseph Green	joseph.green@atlashomegardensolutions.com	+44 600 7803	wholesale	bulk-discount, MOQ-high, wholesale-only, factory-direct, fast-shipping, quality-assured	Japan	5-10 days	PayPal	Bulk orders only. MOQ applies.	\N	\N	\N	\N	\N	\N	\N	\N	0	\N
232	test-user-001	Apex Stationery Company	https://www.apexstationerycompan.net	csv	{}	active	2026-07-01 17:09:52.234084	t	verified	\N	\N	Ethan Brown	ethan.brown@apexstationerycompany.com	+91 200 5191	wholesale	bulk-discount, MOQ-high, wholesale-only, factory-direct, MOQ-low, bulk-discount	Singapore	1-2 weeks	Net 60	Long-standing supplier with consistent quality.	\N	1000.00	\N	\N	\N	\N	\N	\N	0	\N
233	test-user-001	Titan Party Supplies Solutions	https://www.titanpartysuppliesso.org	custom	{}	active	2026-07-01 17:09:52.234084	t	verified	\N	\N	Angela Park	angela.park@titanpartysuppliessolutions.com	+33 300 2715	wholesale	bulk-discount, MOQ-high, wholesale-only, factory-direct, wholesale-only, white-label	Japan	5-7 days	Net 90	Long-standing supplier with consistent quality.	\N	200.00	\N	\N	\N	\N	\N	\N	0	\N
234	test-user-001	Omega Baby Products Corp.	https://www.omegababyproductscor.com	csv	{}	active	2026-07-01 17:09:52.234084	t	verified	\N	\N	Jung Campbell	jung.campbell@omegababyproductscorp.com	+91 500 4255	other	sample-available, white-label, premium, MOQ-low, organic-certified	Thailand	5-7 days	Net 60	Curated product selection. Personal account manager.	\N	1000.00	\N	\N	\N	\N	\N	\N	0	\N
235	test-user-001	Metro Crafts & Sewing Trading Co.	https://www.metrocraftssewingtra.org	custom	{}	active	2026-07-01 17:09:52.234084	t	verified	\N	\N	George Hill	george.hill@metrocraftssewingtradingco.com	+44 300 5009	wholesale	bulk-discount, MOQ-high, wholesale-only, factory-direct, premium, white-label	Brazil	2-3 weeks	T/T	Factory-direct pricing. Samples available.	\N	\N	\N	\N	\N	\N	\N	\N	0	\N
236	test-user-001	Metro Clothing Inc.	https://www.metroclothinginc.com	csv	{}	active	2026-07-01 17:09:52.234084	t	verified	\N	\N	Cynthia Davis	cynthia.davis@metroclothinginc.com	+81 200 4789	wholesale	bulk-discount, MOQ-high, wholesale-only, factory-direct, eco-friendly, dropship-ready	Spain	1-2 weeks	Western Union	Factory-direct pricing. Samples available.	\N	50.00	\N	\N	\N	\N	\N	\N	0	\N
237	test-user-001	Supreme Fashion International	https://www.supremefashionintern.org	csv	{}	active	2026-07-01 17:09:52.234084	t	verified	\N	\N	Patricia Gomez	patricia.gomez@supremefashioninternational.com	+86 400 7018	other	sample-available, white-label, fast-shipping, dropship-ready, private-label	Italy	1-2 weeks	Western Union	Curated product selection. Personal account manager.	\N	200.00	\N	\N	\N	\N	\N	\N	0	\N
238	test-user-001	Apex Bags & Luggage Limited	https://www.apexbagsluggagelimit.com	custom	{}	active	2026-07-01 17:09:52.234084	t	verified	\N	\N	Nicholas Hernandez	nicholas.hernandez@apexbagsluggagelimited.com	+81 400 1989	manufacturer	private-label, custom-packaging, certified, MOQ-low, certified, private-label	Sri Lanka	15-30 days	PayPal + Net 30	In-house design team. Custom packaging available.	\N	\N	\N	\N	\N	\N	\N	\N	0	\N
239	test-user-001	Royal Office Products Trading Co.	https://www.royalofficeproductst.org	csv	{}	active	2026-07-01 17:09:52.234084	t	verified	\N	\N	Susan Robinson	susan.robinson@royalofficeproductstradingco.com	+81 700 4926	other	sample-available, white-label, private-label, dropship-ready, MOQ-low	Spain	7-14 days	Net 45	Specialty supplier. Flexible terms.	\N	1000.00	\N	\N	\N	\N	\N	\N	0	\N
240	test-user-001	Supreme Home Decor Solutions	https://www.supremehomedecorsolu.com	csv	{}	active	2026-07-01 17:09:52.234084	t	verified	\N	\N	Lucas Flores	lucas.flores@supremehomedecorsolutions.com	+33 500 1469	dropshipper	dropship-ready, fast-shipping, global-shipping, MOQ-low, sample-available, eco-friendly	Pakistan	2-3 weeks	Net 30	Automated dropshipping. No minimum order.	\N	\N	\N	\N	\N	\N	\N	\N	0	\N
241	test-user-001	Premier Party Supplies International	https://www.premierpartysupplies.org	custom	{}	active	2026-07-01 17:09:52.234084	t	verified	\N	\N	Steven Torres	steven.torres@premierpartysuppliesinternational.com	+33 600 2636	wholesale	bulk-discount, MOQ-high, wholesale-only, factory-direct, fast-shipping, certified	Sri Lanka	3-5 days	PayPal + Net 30	Bulk orders only. MOQ applies.	\N	1000.00	\N	\N	\N	\N	\N	\N	0	\N
242	test-user-001	Delta Bags & Luggage Corp.	https://www.deltabagsluggagecorp.org	custom	{}	active	2026-07-01 17:09:52.234084	t	verified	\N	\N	Matthew Thompson	matthew.thompson@deltabagsluggagecorp.com	+81 200 2850	other	sample-available, white-label, fast-shipping, organic-certified, custom-packaging	Taiwan	3-7 days	Net 90	Curated product selection. Personal account manager.	\N	500.00	\N	\N	\N	\N	\N	\N	0	\N
243	test-user-001	Elite Kitchen & Dining Group	https://www.elitekitchendininggr.org	api	{}	active	2026-07-01 17:09:52.234084	t	verified	\N	\N	Ashley Li	ashley.li@elitekitchendininggroup.com	+44 500 9093	dropshipper	dropship-ready, fast-shipping, global-shipping, MOQ-low, sample-available, verified-supplier	Thailand	1-2 weeks	Net 60	Worldwide shipping with tracking. Fulfillment within 24h.	\N	\N	\N	\N	\N	\N	\N	\N	0	\N
244	test-user-001	Nova Jewelry & Accessories Limited	https://www.novajewelryaccessori.net	api	{}	active	2026-07-01 17:09:52.234084	t	verified	\N	\N	Anthony Tanaka	anthony.tanaka@novajewelryaccessorieslimited.com	+1 200 1952	dropshipper	dropship-ready, fast-shipping, global-shipping, MOQ-low, sample-available, premium	China	7-10 days	Western Union	Worldwide shipping with tracking. Fulfillment within 24h.	\N	200.00	\N	\N	\N	\N	\N	\N	0	\N
245	test-user-001	Delta Shoes Limited	https://www.deltashoeslimited.net	csv	{}	active	2026-07-01 17:09:52.234084	t	verified	\N	\N	Ryan White	ryan.white@deltashoeslimited.com	+91 300 6359	wholesale	bulk-discount, MOQ-high, wholesale-only, factory-direct, wholesale-only, global-shipping	UAE	7-10 days	PayPal + Net 30	Factory-direct pricing. Samples available.	\N	50.00	\N	\N	\N	\N	\N	\N	0	\N
246	test-user-001	Summit Clothing Holdings	https://www.summitclothingholdin.com	custom	{}	active	2026-07-01 17:09:52.234084	t	verified	\N	\N	Barbara Thomas	barbara.thomas@summitclothingholdings.com	+49 700 6257	wholesale	bulk-discount, MOQ-high, wholesale-only, factory-direct, dropship-ready, fast-shipping	Hong Kong	5-7 days	Net 90	Bulk orders only. MOQ applies.	\N	100.00	\N	\N	\N	\N	\N	\N	0	\N
247	test-user-001	Global Health & Wellness Industries	https://www.globalhealthwellness.com	feed	{}	active	2026-07-01 17:09:52.234084	t	verified	\N	\N	Timothy Smith	timothy.smith@globalhealthwellnessindustries.com	+86 400 1670	other	sample-available, white-label, free-samples, private-label, custom-packaging	Mexico	7-12 days	Net 30	Curated product selection. Personal account manager.	\N	1000.00	\N	\N	\N	\N	\N	\N	0	\N
248	test-user-001	Elite Home Decor Company	https://www.elitehomedecorcompan.org	csv	{}	active	2026-07-01 17:09:52.234084	t	verified	\N	\N	Timothy Park	timothy.park@elitehomedecorcompany.com	+1 700 5873	distributor	retail-ready, verified-supplier, global-shipping, dropship-ready, eco-friendly	South Korea	7-10 days	PayPal + Net 30	Authorized distributor for major brands.	\N	100.00	\N	\N	\N	\N	\N	\N	0	\N
249	test-user-001	Global Pet Supplies Company	https://www.globalpetsuppliescom.com	csv	{}	active	2026-07-01 17:09:52.234084	t	verified	\N	\N	Paul Hernandez	paul.hernandez@globalpetsuppliescompany.com	+33 600 6825	distributor	retail-ready, verified-supplier, eco-friendly, wholesale-only, free-samples	UK	3-5 days	Net 15	Multi-brand distributor. Same-day dispatch.	\N	1000.00	\N	\N	\N	\N	\N	\N	0	\N
250	test-user-001	Supreme Home & Garden Enterprise	https://www.supremehomegardenent.com	csv	{}	active	2026-07-01 17:09:52.234084	t	verified	\N	\N	Jessica Young	jessica.young@supremehomegardenenterprise.com	+33 600 1942	other	sample-available, white-label, dropship-ready, factory-direct, free-samples	Spain	10-15 days	T/T	Curated product selection. Personal account manager.	\N	\N	\N	\N	\N	\N	\N	\N	0	\N
251	test-user-001	Nova Clothing Holdings	https://www.novaclothingholdings.net	api	{}	active	2026-07-01 17:09:52.234084	t	verified	\N	\N	Yuki Singh	yuki.singh@novaclothingholdings.com	+33 600 5464	manufacturer	private-label, custom-packaging, certified, retail-ready, white-label, premium	Malaysia	2-3 weeks	Wire Transfer	In-house design team. Custom packaging available.	\N	500.00	\N	\N	\N	\N	\N	\N	0	\N
252	test-user-001	Alpha Home & Garden Enterprise	https://www.alphahomegardenenter.org	csv	{}	active	2026-07-01 17:09:52.234084	t	verified	\N	\N	Jason Nelson	jason.nelson@alphahomegardenenterprise.com	+49 500 2817	distributor	retail-ready, verified-supplier, premium, sample-available, verified-supplier	Thailand	7-14 days	Western Union	Authorized distributor for major brands.	\N	50.00	\N	\N	\N	\N	\N	\N	0	\N
253	test-user-001	Alpha Electronics Partners	https://www.alphaelectronicspart.com	api	{}	active	2026-07-01 17:09:52.234084	t	verified	\N	\N	Mark Baker	mark.baker@alphaelectronicspartners.com	+1 400 1888	dropshipper	dropship-ready, fast-shipping, global-shipping, MOQ-low, sample-available, MOQ-low	Pakistan	7-12 days	Net 30	Worldwide shipping with tracking. Fulfillment within 24h.	\N	100.00	\N	\N	\N	\N	\N	\N	0	\N
254	test-user-001	Delta Home & Garden Company	https://www.deltahomegardencompa.com	csv	{}	active	2026-07-01 17:09:52.245561	t	verified	\N	\N	Michael Nelson	michael.nelson@deltahomegardencompany.com	+33 600 4413	wholesale	bulk-discount, MOQ-high, wholesale-only, factory-direct, certified, MOQ-low	Philippines	7-12 days	PayPal	Long-standing supplier with consistent quality.	\N	\N	\N	\N	\N	\N	\N	\N	0	\N
255	test-user-001	Vertex Shoes International	https://www.vertexshoesinternati.org	custom	{}	active	2026-07-01 17:09:52.245561	t	verified	\N	\N	Raj Flores	raj.flores@vertexshoesinternational.com	+1 600 2941	wholesale	bulk-discount, MOQ-high, wholesale-only, factory-direct, global-shipping, private-label	Turkey	7-14 days	Wire Transfer	Long-standing supplier with consistent quality.	\N	200.00	\N	\N	\N	\N	\N	\N	0	\N
256	test-user-001	Elite Shoes Corp.	https://www.eliteshoescorp.net	api	{}	active	2026-07-01 17:09:52.245561	t	verified	\N	\N	Kevin Hernandez	kevin.hernandez@eliteshoescorp.com	+33 300 1536	wholesale	bulk-discount, MOQ-high, wholesale-only, factory-direct, retail-ready, fast-shipping	UK	1-2 weeks	Net 30	Factory-direct pricing. Samples available.	\N	100.00	\N	\N	\N	\N	\N	\N	0	\N
257	test-user-001	Apex Tools & Hardware Solutions	https://www.apextoolshardwaresol.org	feed	{}	active	2026-07-01 17:09:52.245561	t	verified	\N	\N	Mia Taylor	mia.taylor@apextoolshardwaresolutions.com	+1 700 1580	manufacturer	private-label, custom-packaging, certified, global-shipping, premium, verified-supplier	Indonesia	7-12 days	Credit Card	In-house design team. Custom packaging available.	\N	500.00	\N	\N	\N	\N	\N	\N	0	\N
258	test-user-001	Peak Tools & Hardware Holdings	https://www.peaktoolshardwarehol.org	custom	{}	active	2026-07-01 17:09:52.245561	t	verified	\N	\N	Gary Lee	gary.lee@peaktoolshardwareholdings.com	+33 500 5058	wholesale	bulk-discount, MOQ-high, wholesale-only, factory-direct, free-samples, dropship-ready	Netherlands	10-15 days	Western Union	Factory-direct pricing. Samples available.	\N	200.00	\N	\N	\N	\N	\N	\N	0	\N
259	test-user-001	Omega Party Supplies Holdings	https://www.omegapartysuppliesho.org	csv	{}	active	2026-07-01 17:09:52.245561	t	verified	\N	\N	Margaret Edwards	margaret.edwards@omegapartysuppliesholdings.com	+33 300 1289	wholesale	bulk-discount, MOQ-high, wholesale-only, factory-direct, global-shipping, certified	Thailand	3-5 days	PayPal	Long-standing supplier with consistent quality.	\N	50.00	\N	\N	\N	\N	\N	\N	0	\N
260	test-user-001	Omega Office Products Sourcing	https://www.omegaofficeproductss.com	feed	{}	active	2026-07-01 17:09:52.245561	t	verified	\N	\N	Sharon Reyes	sharon.reyes@omegaofficeproductssourcing.com	+1 300 7414	dropshipper	dropship-ready, fast-shipping, global-shipping, MOQ-low, sample-available, fast-shipping	Germany	7-12 days	Net 45	Automated dropshipping. No minimum order.	\N	50.00	\N	\N	\N	\N	\N	\N	0	\N
261	test-user-001	Atlas Shoes Industries	https://www.atlasshoesindustries.org	csv	{}	active	2026-07-01 17:09:52.245561	t	verified	\N	\N	Charlotte Martinez	charlotte.martinez@atlasshoesindustries.com	+44 600 1316	wholesale	bulk-discount, MOQ-high, wholesale-only, factory-direct, bulk-discount, free-samples	Hong Kong	5-7 days	Net 90	Bulk orders only. MOQ applies.	\N	\N	\N	\N	\N	\N	\N	\N	0	\N
262	test-user-001	Zenith Pet Supplies Partners	https://www.zenithpetsuppliespar.com	api	{}	active	2026-07-01 17:09:52.245561	t	verified	\N	\N	Amanda Hill	amanda.hill@zenithpetsuppliespartners.com	+1 200 4812	dropshipper	dropship-ready, fast-shipping, global-shipping, MOQ-low, sample-available, sample-available	Italy	15-30 days	Wire Transfer	Automated dropshipping. No minimum order.	\N	500.00	\N	\N	\N	\N	\N	\N	0	\N
263	test-user-001	Alpha Beauty & Personal Care Direct	https://www.alphabeautypersonalc.org	feed	{}	active	2026-07-01 17:09:52.245561	t	verified	\N	\N	Anthony Nelson	anthony.nelson@alphabeautypersonalcaredirect.com	+81 700 4456	wholesale	bulk-discount, MOQ-high, wholesale-only, factory-direct, quality-assured, bulk-discount	Japan	10-15 days	Letter of Credit	Factory-direct pricing. Samples available.	\N	\N	\N	\N	\N	\N	\N	\N	0	\N
264	test-user-001	Titan Bags & Luggage Limited	https://www.titanbagsluggagelimi.com	api	{}	active	2026-07-01 17:09:52.245561	t	verified	\N	\N	Karen Martinez	karen.martinez@titanbagsluggagelimited.com	+49 300 2548	dropshipper	dropship-ready, fast-shipping, global-shipping, MOQ-low, sample-available, MOQ-low	USA	7-14 days	Wire Transfer	Worldwide shipping with tracking. Fulfillment within 24h.	\N	500.00	\N	\N	\N	\N	\N	\N	0	\N
265	test-user-001	Elite Health & Wellness Enterprise	https://www.elitehealthwellnesse.org	csv	{}	active	2026-07-01 17:09:52.245561	t	verified	\N	\N	Min Rivera	min.rivera@elitehealthwellnessenterprise.com	+44 700 3694	other	sample-available, white-label, fast-shipping, global-shipping, dropship-ready	Vietnam	7-14 days	Net 45	Curated product selection. Personal account manager.	\N	50.00	\N	\N	\N	\N	\N	\N	0	\N
266	test-user-001	Peak Jewelry & Accessories International	https://www.peakjewelryaccessori.org	csv	{}	active	2026-07-01 17:09:52.245561	t	verified	\N	\N	Amanda Cruz	amanda.cruz@peakjewelryaccessoriesinternational.com	+49 500 1602	dropshipper	dropship-ready, fast-shipping, global-shipping, MOQ-low, sample-available, fast-shipping	Pakistan	15-30 days	Net 15	Automated dropshipping. No minimum order.	\N	200.00	\N	\N	\N	\N	\N	\N	0	\N
267	test-user-001	Pacific Home Decor Company	https://www.pacifichomedecorcomp.org	csv	{}	active	2026-07-01 17:09:52.245561	t	verified	\N	\N	Jung White	jung.white@pacifichomedecorcompany.com	+1 500 9172	dropshipper	dropship-ready, fast-shipping, global-shipping, MOQ-low, sample-available, custom-packaging	Japan	5-10 days	PayPal + Net 30	Worldwide shipping with tracking. Fulfillment within 24h.	\N	200.00	\N	\N	\N	\N	\N	\N	0	\N
268	test-user-001	Apex Jewelry & Accessories Partners	https://www.apexjewelryaccessori.net	custom	{}	active	2026-07-01 17:09:52.245561	t	verified	\N	\N	Mia Evans	mia.evans@apexjewelryaccessoriespartners.com	+81 700 4608	dropshipper	dropship-ready, fast-shipping, global-shipping, MOQ-low, sample-available, bulk-discount	Brazil	1-2 weeks	PayPal + Net 30	Worldwide shipping with tracking. Fulfillment within 24h.	\N	100.00	\N	\N	\N	\N	\N	\N	0	\N
269	test-user-001	Universal Shoes International	https://www.universalshoesintern.org	custom	{}	active	2026-07-01 17:09:52.245561	t	verified	\N	\N	Lisa Collins	lisa.collins@universalshoesinternational.com	+49 400 4304	dropshipper	dropship-ready, fast-shipping, global-shipping, MOQ-low, sample-available, global-shipping	Canada	1-2 weeks	PayPal	Automated dropshipping. No minimum order.	\N	\N	\N	\N	\N	\N	\N	\N	0	\N
270	test-user-001	Global Crafts & Sewing Direct	https://www.globalcraftssewingdi.org	csv	{}	active	2026-07-01 17:09:52.245561	t	verified	\N	\N	Ryan Liu	ryan.liu@globalcraftssewingdirect.com	+33 300 3002	distributor	retail-ready, verified-supplier, white-label, fast-shipping, dropship-ready	Spain	2-3 weeks	Net 60	Multi-brand distributor. Same-day dispatch.	\N	50.00	\N	\N	\N	\N	\N	\N	0	\N
272	test-user-001	Nova Beauty & Personal Care Limited	https://www.novabeautypersonalca.com	api	{}	active	2026-07-01 17:09:52.245561	t	verified	\N	\N	Barbara Flores	barbara.flores@novabeautypersonalcarelimited.com	+81 400 7134	dropshipper	dropship-ready, fast-shipping, global-shipping, MOQ-low, sample-available, custom-packaging	Italy	7-12 days	Net 90	Automated dropshipping. No minimum order.	\N	\N	\N	\N	\N	\N	\N	\N	0	\N
273	test-user-001	Vertex Baby Products Group	https://www.vertexbabyproductsgr.com	custom	{}	active	2026-07-01 17:09:52.245561	t	verified	\N	\N	Paul Chen	paul.chen@vertexbabyproductsgroup.com	+1 700 3413	other	sample-available, white-label, bulk-discount, organic-certified, quality-assured	Portugal	5-10 days	Wire Transfer	Curated product selection. Personal account manager.	\N	500.00	\N	\N	\N	\N	\N	\N	0	\N
274	test-user-001	Supreme Clothing Partners	https://www.supremeclothingpartn.net	api	{}	active	2026-07-01 17:09:52.245561	t	verified	\N	\N	Mia Nelson	mia.nelson@supremeclothingpartners.com	+81 600 6404	other	sample-available, white-label, bulk-discount, private-label, free-samples	France	7-10 days	Wire Transfer	Curated product selection. Personal account manager.	\N	\N	\N	\N	\N	\N	\N	\N	0	\N
275	test-user-001	Pacific Tools & Hardware Enterprise	https://www.pacifictoolshardware.org	custom	{}	active	2026-07-01 17:09:52.245561	t	verified	\N	\N	Lisa Turner	lisa.turner@pacifictoolshardwareenterprise.com	+49 600 3982	other	sample-available, white-label, wholesale-only, free-samples, MOQ-low	Netherlands	7-10 days	Net 45	Curated product selection. Personal account manager.	\N	100.00	\N	\N	\N	\N	\N	\N	0	\N
276	test-user-001	Supreme Pet Supplies Trading Co.	https://www.supremepetsuppliestr.com	custom	{}	active	2026-07-01 17:09:52.245561	t	verified	\N	\N	Helen Gomez	helen.gomez@supremepetsuppliestradingco.com	+44 600 9369	manufacturer	private-label, custom-packaging, certified, eco-friendly, global-shipping, fast-shipping	Turkey	7-14 days	Net 60	In-house design team. Custom packaging available.	\N	100.00	\N	\N	\N	\N	\N	\N	0	\N
277	test-user-001	Alpha Health & Wellness Corp.	https://www.alphahealthwellnessc.net	custom	{}	active	2026-07-01 17:09:52.245561	t	verified	\N	\N	George Hill	george.hill@alphahealthwellnesscorp.com	+81 600 6787	wholesale	bulk-discount, MOQ-high, wholesale-only, factory-direct, bulk-discount, retail-ready	Sri Lanka	15-30 days	Net 15	Long-standing supplier with consistent quality.	\N	\N	\N	\N	\N	\N	\N	\N	0	\N
278	test-user-001	Supreme Sports & Outdoors Inc.	https://www.supremesportsoutdoor.org	api	{}	active	2026-07-01 17:09:52.245561	t	verified	\N	\N	Nicholas Young	nicholas.young@supremesportsoutdoorsinc.com	+86 700 4115	manufacturer	private-label, custom-packaging, certified, bulk-discount, private-label, organic-certified	Bangladesh	3-7 days	Net 15	In-house design team. Custom packaging available.	\N	500.00	\N	\N	\N	\N	\N	\N	0	\N
279	test-user-001	Peak Clothing Company	https://www.peakclothingcompany.com	csv	{}	active	2026-07-01 17:09:52.245561	t	verified	\N	\N	Ethan Hill	ethan.hill@peakclothingcompany.com	+91 400 3810	wholesale	bulk-discount, MOQ-high, wholesale-only, factory-direct, custom-packaging, dropship-ready	Canada	7-12 days	Letter of Credit	Factory-direct pricing. Samples available.	\N	500.00	\N	\N	\N	\N	\N	\N	0	\N
280	test-user-001	Zenith Electronics International	https://www.zenithelectronicsint.org	api	{}	active	2026-07-01 17:09:52.245561	t	verified	\N	\N	Timothy Turner	timothy.turner@zenithelectronicsinternational.com	+86 500 6027	distributor	retail-ready, verified-supplier, MOQ-low, bulk-discount, free-samples	Japan	14-21 days	Net 90	Authorized distributor for major brands.	\N	\N	\N	\N	\N	\N	\N	\N	0	\N
281	test-user-001	Global Jewelry & Accessories Direct	https://www.globaljewelryaccesso.org	custom	{}	active	2026-07-01 17:09:52.245561	t	verified	\N	\N	Donna Turner	donna.turner@globaljewelryaccessoriesdirect.com	+1 700 8196	dropshipper	dropship-ready, fast-shipping, global-shipping, MOQ-low, sample-available, sample-available	Singapore	3-5 days	T/T	Worldwide shipping with tracking. Fulfillment within 24h.	\N	1000.00	\N	\N	\N	\N	\N	\N	0	\N
282	test-user-001	Supreme Automotive Trading Co.	https://www.supremeautomotivetra.org	api	{}	active	2026-07-01 17:09:52.245561	t	verified	\N	\N	Jennifer Smith	jennifer.smith@supremeautomotivetradingco.com	+91 400 4620	dropshipper	dropship-ready, fast-shipping, global-shipping, MOQ-low, sample-available, sample-available	Italy	5-10 days	PayPal + Net 30	Automated dropshipping. No minimum order.	\N	200.00	\N	\N	\N	\N	\N	\N	0	\N
283	test-user-001	Global Stationery Solutions	https://www.globalstationerysolu.net	feed	{}	active	2026-07-01 17:09:52.245561	t	verified	\N	\N	Fatima Scott	fatima.scott@globalstationerysolutions.com	+81 700 2013	other	sample-available, white-label, retail-ready, private-label, premium	UK	5-7 days	Net 30	Curated product selection. Personal account manager.	\N	50.00	\N	\N	\N	\N	\N	\N	0	\N
284	test-user-001	Metro Automotive Holdings	https://www.metroautomotiveholdi.org	custom	{}	active	2026-07-01 17:09:52.245561	t	verified	\N	\N	Deborah Garcia	deborah.garcia@metroautomotiveholdings.com	+49 700 8469	wholesale	bulk-discount, MOQ-high, wholesale-only, factory-direct, retail-ready, wholesale-only	Poland	1-2 weeks	Western Union	Factory-direct pricing. Samples available.	\N	\N	\N	\N	\N	\N	\N	\N	0	\N
285	test-user-001	Prime Home Decor Holdings	https://www.primehomedecorholdin.com	csv	{}	active	2026-07-01 17:09:52.245561	t	verified	\N	\N	Xia Lopez	xia.lopez@primehomedecorholdings.com	+33 500 1809	distributor	retail-ready, verified-supplier, white-label, premium, fast-shipping	China	7-14 days	Net 45	Multi-brand distributor. Same-day dispatch.	\N	\N	\N	\N	\N	\N	\N	\N	0	\N
286	test-user-001	Pacific Health & Wellness Trading Co.	https://www.pacifichealthwellnes.net	feed	{}	active	2026-07-01 17:09:52.245561	t	verified	\N	\N	Maria Smith	maria.smith@pacifichealthwellnesstradingco.com	+33 600 4884	wholesale	bulk-discount, MOQ-high, wholesale-only, factory-direct, white-label, free-samples	Brazil	7-14 days	Net 60	Long-standing supplier with consistent quality.	\N	50.00	\N	\N	\N	\N	\N	\N	0	\N
287	test-user-001	Global Toys & Hobbies Trading Co.	https://www.globaltoyshobbiestra.com	feed	{}	active	2026-07-01 17:09:52.245561	t	verified	\N	\N	Carol Nelson	carol.nelson@globaltoyshobbiestradingco.com	+81 600 9823	wholesale	bulk-discount, MOQ-high, wholesale-only, factory-direct, eco-friendly, organic-certified	Poland	7-14 days	Letter of Credit	Long-standing supplier with consistent quality.	\N	1000.00	\N	\N	\N	\N	\N	\N	0	\N
288	test-user-001	Global Baby Products Group	https://www.globalbabyproductsgr.org	feed	{}	active	2026-07-01 17:09:52.245561	t	verified	\N	\N	Carlos Wright	carlos.wright@globalbabyproductsgroup.com	+49 500 6087	dropshipper	dropship-ready, fast-shipping, global-shipping, MOQ-low, sample-available, bulk-discount	Indonesia	2-3 weeks	Western Union	Worldwide shipping with tracking. Fulfillment within 24h.	\N	\N	\N	\N	\N	\N	\N	\N	0	\N
289	test-user-001	Atlas Stationery Supplies	https://www.atlasstationerysuppl.net	api	{}	active	2026-07-01 17:09:52.245561	t	verified	\N	\N	Amy Adams	amy.adams@atlasstationerysupplies.com	+33 700 2352	manufacturer	private-label, custom-packaging, certified, wholesale-only, fast-shipping, organic-certified	Pakistan	7-14 days	PayPal	Full OEM/ODM capabilities. ISO certified.	\N	\N	\N	\N	\N	\N	\N	\N	0	\N
290	test-user-001	Alpha Sports & Outdoors Holdings	https://www.alphasportsoutdoorsh.org	api	{}	active	2026-07-01 17:09:52.245561	t	verified	\N	\N	Joshua Campbell	joshua.campbell@alphasportsoutdoorsholdings.com	+1 200 9247	manufacturer	private-label, custom-packaging, certified, sample-available, premium, organic-certified	South Korea	10-15 days	PayPal	Full OEM/ODM capabilities. ISO certified.	\N	50.00	\N	\N	\N	\N	\N	\N	0	\N
291	test-user-001	Alpha Automotive Holdings	https://www.alphaautomotiveholdi.com	custom	{}	active	2026-07-01 17:09:52.245561	t	verified	\N	\N	Priya Rivera	priya.rivera@alphaautomotiveholdings.com	+86 300 6483	other	sample-available, white-label, bulk-discount, retail-ready, wholesale-only	Brazil	3-5 days	Western Union	Curated product selection. Personal account manager.	\N	50.00	\N	\N	\N	\N	\N	\N	0	\N
292	test-user-001	Prime Office Products Limited	https://www.primeofficeproductsl.net	feed	{}	active	2026-07-01 17:09:52.245561	t	verified	\N	\N	Min Chen	min.chen@primeofficeproductslimited.com	+81 300 7037	distributor	retail-ready, verified-supplier, white-label, MOQ-low, premium	China	3-7 days	PayPal	Authorized distributor for major brands.	\N	50.00	\N	\N	\N	\N	\N	\N	0	\N
293	test-user-001	Peak Health & Wellness Solutions	https://www.peakhealthwellnessso.org	api	{}	active	2026-07-01 17:09:52.245561	t	verified	\N	\N	Eric Anderson	eric.anderson@peakhealthwellnesssolutions.com	+91 200 2186	other	sample-available, white-label, factory-direct, MOQ-low, custom-packaging	Malaysia	2-3 weeks	T/T	Curated product selection. Personal account manager.	\N	\N	\N	\N	\N	\N	\N	\N	0	\N
294	test-user-001	Premier Toys & Hobbies Enterprise	https://www.premiertoyshobbiesen.org	csv	{}	active	2026-07-01 17:09:52.245561	t	verified	\N	\N	John Wang	john.wang@premiertoyshobbiesenterprise.com	+1 700 2980	other	sample-available, white-label, custom-packaging, bulk-discount, quality-assured	Netherlands	7-14 days	Net 30	Curated product selection. Personal account manager.	\N	\N	\N	\N	\N	\N	\N	\N	0	\N
295	test-user-001	Atlas Camping & Hiking Sourcing	https://www.atlascampinghikingso.net	custom	{}	active	2026-07-01 17:09:52.245561	t	verified	\N	\N	Angela Singh	angela.singh@atlascampinghikingsourcing.com	+91 400 4014	distributor	retail-ready, verified-supplier, wholesale-only, MOQ-low, dropship-ready	Mexico	2-3 weeks	Net 90	Multi-brand distributor. Same-day dispatch.	\N	50.00	\N	\N	\N	\N	\N	\N	0	\N
296	test-user-001	Delta Health & Wellness Limited	https://www.deltahealthwellnessl.net	custom	{}	active	2026-07-01 17:09:52.245561	t	verified	\N	\N	Frank Collins	frank.collins@deltahealthwellnesslimited.com	+81 700 8868	distributor	retail-ready, verified-supplier, eco-friendly, private-label, verified-supplier	Vietnam	14-21 days	Net 15	Multi-brand distributor. Same-day dispatch.	\N	1000.00	\N	\N	\N	\N	\N	\N	0	\N
297	test-user-001	Royal Home Decor Enterprise	https://www.royalhomedecorenterp.net	feed	{}	active	2026-07-01 17:09:52.245561	t	verified	\N	\N	Frank Taylor	frank.taylor@royalhomedecorenterprise.com	+91 200 8530	dropshipper	dropship-ready, fast-shipping, global-shipping, MOQ-low, sample-available, organic-certified	Portugal	2-3 weeks	Net 15	Worldwide shipping with tracking. Fulfillment within 24h.	\N	50.00	\N	\N	\N	\N	\N	\N	0	\N
298	test-user-001	Metro Baby Products Sourcing	https://www.metrobabyproductssou.com	custom	{}	active	2026-07-01 17:09:52.245561	t	verified	\N	\N	Andrew Suzuki	andrew.suzuki@metrobabyproductssourcing.com	+33 300 2215	other	sample-available, white-label, premium, private-label, MOQ-high	Brazil	5-10 days	Credit Card	Curated product selection. Personal account manager.	\N	100.00	\N	\N	\N	\N	\N	\N	0	\N
299	test-user-001	Vertex Stationery Inc.	https://www.vertexstationeryinc.com	feed	{}	active	2026-07-01 17:09:52.245561	t	verified	\N	\N	Ronald Mitchell	ronald.mitchell@vertexstationeryinc.com	+33 200 2227	other	sample-available, white-label, MOQ-low, factory-direct, bulk-discount	Vietnam	7-12 days	T/T	Curated product selection. Personal account manager.	\N	50.00	\N	\N	\N	\N	\N	\N	0	\N
300	test-user-001	Zenith Kitchen & Dining Supplies	https://www.zenithkitchendinings.net	csv	{}	active	2026-07-01 17:09:52.245561	t	verified	\N	\N	Linda Baker	linda.baker@zenithkitchendiningsupplies.com	+91 600 5703	other	sample-available, white-label, factory-direct, MOQ-low, free-samples	Turkey	7-10 days	Net 15	Specialty supplier. Flexible terms.	\N	200.00	\N	\N	\N	\N	\N	\N	0	\N
301	test-user-001	Atlas Automotive Enterprise	https://www.atlasautomotiveenter.com	feed	{}	active	2026-07-01 17:09:52.245561	t	verified	\N	\N	Amy Mitchell	amy.mitchell@atlasautomotiveenterprise.com	+91 600 4816	dropshipper	dropship-ready, fast-shipping, global-shipping, MOQ-low, sample-available, white-label	Brazil	3-5 days	Wire Transfer	Worldwide shipping with tracking. Fulfillment within 24h.	\N	\N	\N	\N	\N	\N	\N	\N	0	\N
302	test-user-001	Metro Camping & Hiking Group	https://www.metrocampinghikinggr.net	csv	{}	active	2026-07-01 17:09:52.245561	t	verified	\N	\N	Rebecca Hernandez	rebecca.hernandez@metrocampinghikinggroup.com	+1 300 3131	distributor	retail-ready, verified-supplier, retail-ready, eco-friendly, dropship-ready	Australia	2-3 weeks	Wire Transfer	Authorized distributor for major brands.	\N	100.00	\N	\N	\N	\N	\N	\N	0	\N
303	test-user-001	Peak Home Decor Enterprise	https://www.peakhomedecorenterpr.net	api	{}	active	2026-07-01 17:09:52.245561	t	verified	\N	\N	Aiko Torres	aiko.torres@peakhomedecorenterprise.com	+49 400 2687	other	sample-available, white-label, free-samples, white-label, eco-friendly	Germany	7-10 days	PayPal	Specialty supplier. Flexible terms.	\N	1000.00	\N	\N	\N	\N	\N	\N	0	\N
304	test-user-001	Metro Pet Supplies International	https://www.metropetsuppliesinte.com	csv	{}	active	2026-07-01 17:09:52.264602	t	verified	\N	\N	Sandra Young	sandra.young@metropetsuppliesinternational.com	+86 400 6703	wholesale	bulk-discount, MOQ-high, wholesale-only, factory-direct, free-samples, eco-friendly	Pakistan	1-2 weeks	Wire Transfer	Bulk orders only. MOQ applies.	\N	\N	\N	\N	\N	\N	\N	\N	0	\N
305	test-user-001	Omega Clothing Sourcing	https://www.omegaclothingsourcin.com	csv	{}	active	2026-07-01 17:09:52.264602	t	verified	\N	\N	Lisa Li	lisa.li@omegaclothingsourcing.com	+81 200 5814	distributor	retail-ready, verified-supplier, eco-friendly, certified, premium	Netherlands	7-14 days	PayPal	Multi-brand distributor. Same-day dispatch.	\N	200.00	\N	\N	\N	\N	\N	\N	0	\N
306	test-user-001	Pacific Shoes Sourcing	https://www.pacificshoessourcing.net	feed	{}	active	2026-07-01 17:09:52.264602	t	verified	\N	\N	Aiko Wilson	aiko.wilson@pacificshoessourcing.com	+33 500 8449	distributor	retail-ready, verified-supplier, free-samples, factory-direct, certified	UK	5-7 days	PayPal	Multi-brand distributor. Same-day dispatch.	\N	1000.00	\N	\N	\N	\N	\N	\N	0	\N
307	test-user-001	Peak Sports & Outdoors Holdings	https://www.peaksportsoutdoorsho.org	custom	{}	active	2026-07-01 17:09:52.264602	t	verified	\N	\N	Kevin Anderson	kevin.anderson@peaksportsoutdoorsholdings.com	+49 600 4217	manufacturer	private-label, custom-packaging, certified, factory-direct, white-label, bulk-discount	China	2-3 weeks	T/T	In-house design team. Custom packaging available.	\N	100.00	\N	\N	\N	\N	\N	\N	0	\N
308	test-user-001	Vertex Home & Garden Enterprise	https://www.vertexhomegardenente.org	feed	{}	active	2026-07-01 17:09:52.264602	t	verified	\N	\N	Richard Moore	richard.moore@vertexhomegardenenterprise.com	+81 500 6069	dropshipper	dropship-ready, fast-shipping, global-shipping, MOQ-low, sample-available, fast-shipping	Portugal	7-10 days	T/T	Automated dropshipping. No minimum order.	\N	100.00	\N	\N	\N	\N	\N	\N	0	\N
309	test-user-001	Supreme Shoes Supplies	https://www.supremeshoessupplies.net	feed	{}	active	2026-07-01 17:09:52.264602	t	verified	\N	\N	Raj Rivera	raj.rivera@supremeshoessupplies.com	+91 200 7748	other	sample-available, white-label, premium, private-label, custom-packaging	Bangladesh	1-2 weeks	PayPal	Curated product selection. Personal account manager.	\N	200.00	\N	\N	\N	\N	\N	\N	0	\N
310	test-user-001	Alpha Clothing Inc.	https://www.alphaclothinginc.com	custom	{}	active	2026-07-01 17:09:52.264602	t	verified	\N	\N	Barbara Hall	barbara.hall@alphaclothinginc.com	+33 300 4890	dropshipper	dropship-ready, fast-shipping, global-shipping, MOQ-low, sample-available, eco-friendly	Netherlands	5-7 days	PayPal + Net 30	Automated dropshipping. No minimum order.	\N	1000.00	\N	\N	\N	\N	\N	\N	0	\N
311	test-user-001	Royal Sports & Outdoors Solutions	https://www.royalsportsoutdoorss.org	csv	{}	active	2026-07-01 17:09:52.264602	t	verified	\N	\N	Karen Turner	karen.turner@royalsportsoutdoorssolutions.com	+91 700 6840	dropshipper	dropship-ready, fast-shipping, global-shipping, MOQ-low, sample-available, private-label	Taiwan	14-21 days	Western Union	Automated dropshipping. No minimum order.	\N	1000.00	\N	\N	\N	\N	\N	\N	0	\N
312	test-user-001	Zenith Crafts & Sewing Industries	https://www.zenithcraftssewingin.net	csv	{}	active	2026-07-01 17:09:52.264602	t	verified	\N	\N	George Park	george.park@zenithcraftssewingindustries.com	+33 300 3026	other	sample-available, white-label, premium, factory-direct, eco-friendly	Australia	7-12 days	Net 60	Curated product selection. Personal account manager.	\N	200.00	\N	\N	\N	\N	\N	\N	0	\N
313	test-user-001	Titan Health & Wellness International	https://www.titanhealthwellnessi.com	feed	{}	active	2026-07-01 17:09:52.264602	t	verified	\N	\N	Mark Davis	mark.davis@titanhealthwellnessinternational.com	+86 200 8151	dropshipper	dropship-ready, fast-shipping, global-shipping, MOQ-low, sample-available, eco-friendly	Turkey	3-7 days	Net 90	Worldwide shipping with tracking. Fulfillment within 24h.	\N	200.00	\N	\N	\N	\N	\N	\N	0	\N
314	test-user-001	Titan Shoes Holdings	https://www.titanshoesholdings.net	csv	{}	active	2026-07-01 17:09:52.264602	t	verified	\N	\N	Mia Rivera	mia.rivera@titanshoesholdings.com	+86 300 9269	dropshipper	dropship-ready, fast-shipping, global-shipping, MOQ-low, sample-available, private-label	France	10-15 days	Net 90	Automated dropshipping. No minimum order.	\N	50.00	\N	\N	\N	\N	\N	\N	0	\N
315	test-user-001	Prime Bags & Luggage Limited	https://www.primebagsluggagelimi.com	api	{}	active	2026-07-01 17:09:52.264602	t	verified	\N	\N	Paul White	paul.white@primebagsluggagelimited.com	+44 500 2420	other	sample-available, white-label, retail-ready, MOQ-high, quality-assured	Taiwan	7-12 days	Net 90	Specialty supplier. Flexible terms.	\N	\N	\N	\N	\N	\N	\N	\N	0	\N
316	test-user-001	Premier Office Products Holdings	https://www.premierofficeproduct.net	feed	{}	active	2026-07-01 17:09:52.264602	t	verified	\N	\N	Angela Hall	angela.hall@premierofficeproductsholdings.com	+1 700 1504	wholesale	bulk-discount, MOQ-high, wholesale-only, factory-direct, custom-packaging, certified	Netherlands	7-14 days	Western Union	Long-standing supplier with consistent quality.	\N	100.00	\N	\N	\N	\N	\N	\N	0	\N
317	test-user-001	Royal Pet Supplies Trading Co.	https://www.royalpetsuppliestrad.org	csv	{}	active	2026-07-01 17:09:52.264602	t	verified	\N	\N	Aiko Anderson	aiko.anderson@royalpetsuppliestradingco.com	+86 300 2842	dropshipper	dropship-ready, fast-shipping, global-shipping, MOQ-low, sample-available, certified	Brazil	14-21 days	PayPal	Automated dropshipping. No minimum order.	\N	100.00	\N	\N	\N	\N	\N	\N	0	\N
318	test-user-001	Nova Camping & Hiking Trading Co.	https://www.novacampinghikingtra.com	custom	{}	active	2026-07-01 17:09:52.264602	t	verified	\N	\N	Jason Torres	jason.torres@novacampinghikingtradingco.com	+44 500 9267	dropshipper	dropship-ready, fast-shipping, global-shipping, MOQ-low, sample-available, MOQ-high	Thailand	2-3 weeks	Credit Card	Worldwide shipping with tracking. Fulfillment within 24h.	\N	50.00	\N	\N	\N	\N	\N	\N	0	\N
319	test-user-001	Peak Electronics Holdings	https://www.peakelectronicsholdi.net	feed	{}	active	2026-07-01 17:09:52.264602	t	verified	\N	\N	Michael Miller	michael.miller@peakelectronicsholdings.com	+49 500 3527	dropshipper	dropship-ready, fast-shipping, global-shipping, MOQ-low, sample-available, verified-supplier	Portugal	7-12 days	Net 90	Worldwide shipping with tracking. Fulfillment within 24h.	\N	50.00	\N	\N	\N	\N	\N	\N	0	\N
320	test-user-001	Universal Home & Garden Industries	https://www.universalhomegardeni.net	csv	{}	active	2026-07-01 17:09:52.264602	t	verified	\N	\N	Charlotte Phillips	charlotte.phillips@universalhomegardenindustries.com	+44 500 4807	wholesale	bulk-discount, MOQ-high, wholesale-only, factory-direct, MOQ-high, private-label	Thailand	5-10 days	Net 90	Factory-direct pricing. Samples available.	\N	\N	\N	\N	\N	\N	\N	\N	0	\N
321	test-user-001	Apex Camping & Hiking Enterprise	https://www.apexcampinghikingent.net	custom	{}	active	2026-07-01 17:09:52.264602	t	verified	\N	\N	Sarah Evans	sarah.evans@apexcampinghikingenterprise.com	+33 400 4337	dropshipper	dropship-ready, fast-shipping, global-shipping, MOQ-low, sample-available, bulk-discount	Indonesia	5-10 days	Net 90	Automated dropshipping. No minimum order.	\N	500.00	\N	\N	\N	\N	\N	\N	0	\N
322	test-user-001	Elite Electronics Partners	https://www.eliteelectronicspart.com	csv	{}	active	2026-07-01 17:09:52.264602	t	verified	\N	\N	Timothy Anderson	timothy.anderson@eliteelectronicspartners.com	+33 200 1326	manufacturer	private-label, custom-packaging, certified, eco-friendly, private-label, retail-ready	USA	14-21 days	Net 15	Full OEM/ODM capabilities. ISO certified.	\N	50.00	\N	\N	\N	\N	\N	\N	0	\N
323	test-user-001	Universal Sports & Outdoors Supplies	https://www.universalsportsoutdo.net	feed	{}	active	2026-07-01 17:09:52.264602	t	verified	\N	\N	Stephanie Rivera	stephanie.rivera@universalsportsoutdoorssupplies.com	+86 400 1916	other	sample-available, white-label, fast-shipping, sample-available, factory-direct	Canada	5-10 days	Net 30	Curated product selection. Personal account manager.	\N	1000.00	\N	\N	\N	\N	\N	\N	0	\N
324	test-user-001	Prime Eyewear Solutions	https://www.primeeyewearsolution.net	csv	{}	active	2026-07-01 17:09:52.264602	t	verified	\N	\N	Fatima Clark	fatima.clark@primeeyewearsolutions.com	+49 300 3843	manufacturer	private-label, custom-packaging, certified, sample-available, dropship-ready, custom-packaging	Netherlands	7-10 days	T/T	In-house design team. Custom packaging available.	\N	500.00	\N	\N	\N	\N	\N	\N	0	\N
325	test-user-001	Atlas Bags & Luggage Group	https://www.atlasbagsluggagegrou.com	custom	{}	active	2026-07-01 17:09:52.264602	t	verified	\N	\N	Ethan Khan	ethan.khan@atlasbagsluggagegroup.com	+86 200 8491	distributor	retail-ready, verified-supplier, MOQ-low, sample-available, retail-ready	Australia	2-3 weeks	Net 15	Multi-brand distributor. Same-day dispatch.	\N	50.00	\N	\N	\N	\N	\N	\N	0	\N
326	test-user-001	Atlas Pet Supplies Inc.	https://www.atlaspetsuppliesinc.org	custom	{}	active	2026-07-01 17:09:52.264602	t	verified	\N	\N	Amy Diaz	amy.diaz@atlaspetsuppliesinc.com	+33 200 6629	other	sample-available, white-label, fast-shipping, eco-friendly, retail-ready	Thailand	7-10 days	Net 60	Specialty supplier. Flexible terms.	\N	50.00	\N	\N	\N	\N	\N	\N	0	\N
327	test-user-001	Nova Health & Wellness Partners	https://www.novahealthwellnesspa.net	custom	{}	active	2026-07-01 17:09:52.264602	t	verified	\N	\N	Donna Mitchell	donna.mitchell@novahealthwellnesspartners.com	+1 500 8350	wholesale	bulk-discount, MOQ-high, wholesale-only, factory-direct, private-label, global-shipping	China	15-30 days	T/T	Factory-direct pricing. Samples available.	\N	1000.00	\N	\N	\N	\N	\N	\N	0	\N
328	test-user-001	Prime Health & Wellness Enterprise	https://www.primehealthwellnesse.net	feed	{}	active	2026-07-01 17:09:52.264602	t	verified	\N	\N	James Adams	james.adams@primehealthwellnessenterprise.com	+86 500 4538	distributor	retail-ready, verified-supplier, fast-shipping, certified, custom-packaging	India	5-7 days	T/T	Multi-brand distributor. Same-day dispatch.	\N	50.00	\N	\N	\N	\N	\N	\N	0	\N
329	test-user-001	Premier Sports & Outdoors Enterprise	https://www.premiersportsoutdoor.net	custom	{}	active	2026-07-01 17:09:52.264602	t	verified	\N	\N	Carol Jones	carol.jones@premiersportsoutdoorsenterprise.com	+33 300 8036	other	sample-available, white-label, certified, dropship-ready, MOQ-low	Poland	15-30 days	T/T	Specialty supplier. Flexible terms.	\N	100.00	\N	\N	\N	\N	\N	\N	0	\N
330	test-user-001	Premier Baby Products International	https://www.premierbabyproductsi.org	api	{}	active	2026-07-01 17:09:52.264602	t	verified	\N	\N	Donald Reyes	donald.reyes@premierbabyproductsinternational.com	+91 500 1542	other	sample-available, white-label, fast-shipping, premium, MOQ-high	Portugal	7-10 days	PayPal + Net 30	Specialty supplier. Flexible terms.	\N	200.00	\N	\N	\N	\N	\N	\N	0	\N
331	test-user-001	Elite Lighting Trading Co.	https://www.elitelightingtrading.org	csv	{}	active	2026-07-01 17:09:52.264602	t	verified	\N	\N	Jeffrey Liu	jeffrey.liu@elitelightingtradingco.com	+1 700 3038	wholesale	bulk-discount, MOQ-high, wholesale-only, factory-direct, bulk-discount, private-label	Italy	7-14 days	Western Union	Bulk orders only. MOQ applies.	\N	\N	\N	\N	\N	\N	\N	\N	0	\N
332	test-user-001	Vertex Home Decor Company	https://www.vertexhomedecorcompa.net	custom	{}	active	2026-07-01 17:09:52.264602	t	verified	\N	\N	Deborah Garcia	deborah.garcia@vertexhomedecorcompany.com	+81 700 4506	distributor	retail-ready, verified-supplier, private-label, MOQ-low, dropship-ready	UAE	14-21 days	Net 30	Authorized distributor for major brands.	\N	\N	\N	\N	\N	\N	\N	\N	0	\N
333	test-user-001	Royal Jewelry & Accessories Corp.	https://www.royaljewelryaccessor.org	feed	{}	active	2026-07-01 17:09:52.264602	t	verified	\N	\N	Michael Choi	michael.choi@royaljewelryaccessoriescorp.com	+33 700 7764	wholesale	bulk-discount, MOQ-high, wholesale-only, factory-direct, fast-shipping, white-label	Vietnam	7-14 days	Net 90	Long-standing supplier with consistent quality.	\N	1000.00	\N	\N	\N	\N	\N	\N	0	\N
334	test-user-001	Prime Tools & Hardware Enterprise	https://www.primetoolshardwareen.com	feed	{}	active	2026-07-01 17:09:52.264602	t	verified	\N	\N	Jennifer Cruz	jennifer.cruz@primetoolshardwareenterprise.com	+91 300 4921	manufacturer	private-label, custom-packaging, certified, factory-direct, sample-available, certified	Singapore	10-15 days	Net 15	Full OEM/ODM capabilities. ISO certified.	\N	\N	\N	\N	\N	\N	\N	\N	0	\N
335	test-user-001	Delta Tools & Hardware Inc.	https://www.deltatoolshardwarein.net	csv	{}	active	2026-07-01 17:09:52.264602	t	verified	\N	\N	Xia Phillips	xia.phillips@deltatoolshardwareinc.com	+91 400 6389	distributor	retail-ready, verified-supplier, bulk-discount, premium, wholesale-only	India	5-10 days	PayPal	Authorized distributor for major brands.	\N	50.00	\N	\N	\N	\N	\N	\N	0	\N
336	test-user-001	Alpha Jewelry & Accessories Sourcing	https://www.alphajewelryaccessor.com	custom	{}	active	2026-07-01 17:09:52.264602	t	verified	\N	\N	Donald Kim	donald.kim@alphajewelryaccessoriessourcing.com	+44 700 7825	wholesale	bulk-discount, MOQ-high, wholesale-only, factory-direct, fast-shipping, dropship-ready	France	7-10 days	Credit Card	Long-standing supplier with consistent quality.	\N	200.00	\N	\N	\N	\N	\N	\N	0	\N
337	test-user-001	Supreme Lighting Supplies	https://www.supremelightingsuppl.org	feed	{}	active	2026-07-01 17:09:52.264602	t	verified	\N	\N	Min Li	min.li@supremelightingsupplies.com	+44 200 7309	wholesale	bulk-discount, MOQ-high, wholesale-only, factory-direct, bulk-discount, certified	USA	3-5 days	Credit Card	Bulk orders only. MOQ applies.	\N	50.00	\N	\N	\N	\N	\N	\N	0	\N
338	test-user-001	Vertex Pet Supplies Group	https://www.vertexpetsuppliesgro.com	feed	{}	active	2026-07-01 17:09:52.264602	t	verified	\N	\N	Joshua Adams	joshua.adams@vertexpetsuppliesgroup.com	+81 700 9275	dropshipper	dropship-ready, fast-shipping, global-shipping, MOQ-low, sample-available, custom-packaging	India	5-7 days	PayPal	Worldwide shipping with tracking. Fulfillment within 24h.	\N	50.00	\N	\N	\N	\N	\N	\N	0	\N
339	test-user-001	Nova Furniture Inc.	https://www.novafurnitureinc.net	custom	{}	active	2026-07-01 17:09:52.264602	t	verified	\N	\N	Ryan Chen	ryan.chen@novafurnitureinc.com	+49 400 2646	distributor	retail-ready, verified-supplier, bulk-discount, retail-ready, premium	UAE	2-3 weeks	Western Union	Authorized distributor for major brands.	\N	200.00	\N	\N	\N	\N	\N	\N	0	\N
340	test-user-001	Omega Sports & Outdoors Limited	https://www.omegasportsoutdoorsl.net	api	{}	active	2026-07-01 17:09:52.264602	t	verified	\N	\N	Ryan Diaz	ryan.diaz@omegasportsoutdoorslimited.com	+44 400 6675	other	sample-available, white-label, MOQ-high, eco-friendly, bulk-discount	Germany	3-5 days	T/T	Specialty supplier. Flexible terms.	\N	500.00	\N	\N	\N	\N	\N	\N	0	\N
341	test-user-001	Nova Shoes Sourcing	https://www.novashoessourcing.net	api	{}	active	2026-07-01 17:09:52.264602	t	verified	\N	\N	Brian Williams	brian.williams@novashoessourcing.com	+44 300 4787	manufacturer	private-label, custom-packaging, certified, free-samples, bulk-discount, eco-friendly	UAE	5-10 days	Net 30	In-house design team. Custom packaging available.	\N	1000.00	\N	\N	\N	\N	\N	\N	0	\N
342	test-user-001	Vertex Phone Accessories Direct	https://www.vertexphoneaccessori.net	csv	{}	active	2026-07-01 17:09:52.264602	t	verified	\N	\N	Min Anderson	min.anderson@vertexphoneaccessoriesdirect.com	+81 200 8105	dropshipper	dropship-ready, fast-shipping, global-shipping, MOQ-low, sample-available, retail-ready	Japan	5-10 days	Net 90	Automated dropshipping. No minimum order.	\N	\N	\N	\N	\N	\N	\N	\N	0	\N
343	test-user-001	Omega Jewelry & Accessories Supplies	https://www.omegajewelryaccessor.net	feed	{}	active	2026-07-01 17:09:52.264602	t	verified	\N	\N	Mary Yang	mary.yang@omegajewelryaccessoriessupplies.com	+44 300 9790	dropshipper	dropship-ready, fast-shipping, global-shipping, MOQ-low, sample-available, private-label	Japan	5-10 days	Wire Transfer	Automated dropshipping. No minimum order.	\N	\N	\N	\N	\N	\N	\N	\N	0	\N
344	test-user-001	Pacific Toys & Hobbies Limited	https://www.pacifictoyshobbiesli.org	api	{}	active	2026-07-01 17:09:52.264602	t	verified	\N	\N	Jennifer Rivera	jennifer.rivera@pacifictoyshobbieslimited.com	+81 400 6065	distributor	retail-ready, verified-supplier, dropship-ready, factory-direct, MOQ-high	UK	5-10 days	Net 45	Authorized distributor for major brands.	\N	200.00	\N	\N	\N	\N	\N	\N	0	\N
345	test-user-001	Summit Jewelry & Accessories Trading Co.	https://www.summitjewelryaccesso.org	csv	{}	active	2026-07-01 17:09:52.264602	t	verified	\N	\N	Kevin Cruz	kevin.cruz@summitjewelryaccessoriestradingco.com	+44 700 6018	wholesale	bulk-discount, MOQ-high, wholesale-only, factory-direct, MOQ-low, fast-shipping	India	5-10 days	Wire Transfer	Factory-direct pricing. Samples available.	\N	1000.00	\N	\N	\N	\N	\N	\N	0	\N
346	test-user-001	Alpha Bags & Luggage Partners	https://www.alphabagsluggagepart.com	custom	{}	active	2026-07-01 17:09:52.264602	t	verified	\N	\N	Rebecca Martin	rebecca.martin@alphabagsluggagepartners.com	+81 500 9611	manufacturer	private-label, custom-packaging, certified, MOQ-low, MOQ-high, bulk-discount	Canada	14-21 days	Letter of Credit	Full OEM/ODM capabilities. ISO certified.	\N	500.00	\N	\N	\N	\N	\N	\N	0	\N
347	test-user-001	Premier Health & Wellness Holdings	https://www.premierhealthwellnes.net	api	{}	active	2026-07-01 17:09:52.264602	t	verified	\N	\N	Sophia Wright	sophia.wright@premierhealthwellnessholdings.com	+33 500 4526	dropshipper	dropship-ready, fast-shipping, global-shipping, MOQ-low, sample-available, fast-shipping	India	1-2 weeks	Net 45	Automated dropshipping. No minimum order.	\N	100.00	\N	\N	\N	\N	\N	\N	0	\N
348	test-user-001	Elite Toys & Hobbies Industries	https://www.elitetoyshobbiesindu.org	api	{}	active	2026-07-01 17:09:52.264602	t	verified	\N	\N	Linda Thomas	linda.thomas@elitetoyshobbiesindustries.com	+91 400 6281	other	sample-available, white-label, fast-shipping, retail-ready, MOQ-high	UK	2-3 weeks	Net 15	Specialty supplier. Flexible terms.	\N	\N	\N	\N	\N	\N	\N	\N	0	\N
349	test-user-001	Supreme Jewelry & Accessories Group	https://www.supremejewelryaccess.net	feed	{}	active	2026-07-01 17:09:52.264602	t	verified	\N	\N	Eric Moore	eric.moore@supremejewelryaccessoriesgroup.com	+1 300 2552	other	sample-available, white-label, fast-shipping, eco-friendly, white-label	Vietnam	7-12 days	PayPal	Specialty supplier. Flexible terms.	\N	500.00	\N	\N	\N	\N	\N	\N	0	\N
350	test-user-001	Vertex Toys & Hobbies Direct	https://www.vertextoyshobbiesdir.org	api	{}	active	2026-07-01 17:09:52.264602	t	verified	\N	\N	Barbara Wilson	barbara.wilson@vertextoyshobbiesdirect.com	+86 600 3768	distributor	retail-ready, verified-supplier, free-samples, fast-shipping, certified	Mexico	7-10 days	T/T	Authorized distributor for major brands.	\N	50.00	\N	\N	\N	\N	\N	\N	0	\N
351	test-user-001	Metro Tools & Hardware Group	https://www.metrotoolshardwaregr.com	custom	{}	active	2026-07-01 17:09:52.264602	t	verified	\N	\N	Matthew Hernandez	matthew.hernandez@metrotoolshardwaregroup.com	+33 700 9440	other	sample-available, white-label, custom-packaging, private-label, certified	UAE	10-15 days	Letter of Credit	Specialty supplier. Flexible terms.	\N	\N	\N	\N	\N	\N	\N	\N	0	\N
352	test-user-001	Nova Baby Products Inc.	https://www.novababyproductsinc.org	custom	{}	active	2026-07-01 17:09:52.264602	t	verified	\N	\N	Amanda Miller	amanda.miller@novababyproductsinc.com	+91 500 3710	manufacturer	private-label, custom-packaging, certified, fast-shipping, dropship-ready, sample-available	Australia	7-12 days	PayPal	In-house design team. Custom packaging available.	\N	\N	\N	\N	\N	\N	\N	\N	0	\N
353	test-user-001	Summit Beauty & Personal Care Enterprise	https://www.summitbeautypersonal.net	feed	{}	active	2026-07-01 17:09:52.264602	t	verified	\N	\N	Mia Lee	mia.lee@summitbeautypersonalcareenterprise.com	+81 600 7204	other	sample-available, white-label, premium, dropship-ready, factory-direct	Australia	10-15 days	Wire Transfer	Specialty supplier. Flexible terms.	\N	\N	\N	\N	\N	\N	\N	\N	0	\N
354	test-user-001	Apex Fashion Direct	https://www.apexfashiondirect.com	csv	{}	active	2026-07-01 17:09:52.275955	t	verified	\N	\N	Charlotte Collins	charlotte.collins@apexfashiondirect.com	+49 300 9885	other	sample-available, white-label, wholesale-only, verified-supplier, bulk-discount	Singapore	7-12 days	PayPal	Curated product selection. Personal account manager.	\N	50.00	\N	\N	\N	\N	\N	\N	0	\N
355	test-user-001	Elite Office Products Company	https://www.eliteofficeproductsc.com	api	{}	active	2026-07-01 17:09:52.275955	t	verified	\N	\N	Frank Robinson	frank.robinson@eliteofficeproductscompany.com	+44 500 9645	dropshipper	dropship-ready, fast-shipping, global-shipping, MOQ-low, sample-available, white-label	USA	7-12 days	PayPal + Net 30	Worldwide shipping with tracking. Fulfillment within 24h.	\N	100.00	\N	\N	\N	\N	\N	\N	0	\N
356	test-user-001	Delta Home Decor Supplies	https://www.deltahomedecorsuppli.org	feed	{}	active	2026-07-01 17:09:52.275955	t	verified	\N	\N	David Hill	david.hill@deltahomedecorsupplies.com	+49 300 3607	dropshipper	dropship-ready, fast-shipping, global-shipping, MOQ-low, sample-available, fast-shipping	Australia	7-14 days	Net 45	Automated dropshipping. No minimum order.	\N	200.00	\N	\N	\N	\N	\N	\N	0	\N
357	test-user-001	Summit Home Decor Limited	https://www.summithomedecorlimit.com	custom	{}	active	2026-07-01 17:09:52.275955	t	verified	\N	\N	Anna Park	anna.park@summithomedecorlimited.com	+33 200 1075	dropshipper	dropship-ready, fast-shipping, global-shipping, MOQ-low, sample-available, quality-assured	Singapore	1-2 weeks	Net 45	Automated dropshipping. No minimum order.	\N	200.00	\N	\N	\N	\N	\N	\N	0	\N
358	test-user-001	Alpha Phone Accessories Group	https://www.alphaphoneaccessorie.org	csv	{}	active	2026-07-01 17:09:52.275955	t	verified	\N	\N	Barbara Wilson	barbara.wilson@alphaphoneaccessoriesgroup.com	+91 400 1812	wholesale	bulk-discount, MOQ-high, wholesale-only, factory-direct, retail-ready, wholesale-only	Singapore	7-12 days	Credit Card	Bulk orders only. MOQ applies.	\N	50.00	\N	\N	\N	\N	\N	\N	0	\N
359	test-user-001	Royal Shoes Industries	https://www.royalshoesindustries.org	feed	{}	active	2026-07-01 17:09:52.275955	t	verified	\N	\N	Kevin Smith	kevin.smith@royalshoesindustries.com	+44 300 9488	other	sample-available, white-label, global-shipping, eco-friendly, verified-supplier	Japan	1-2 weeks	PayPal + Net 30	Specialty supplier. Flexible terms.	\N	1000.00	\N	\N	\N	\N	\N	\N	0	\N
360	test-user-001	Prime Stationery Company	https://www.primestationerycompa.com	custom	{}	active	2026-07-01 17:09:52.275955	t	verified	\N	\N	Frank Martinez	frank.martinez@primestationerycompany.com	+49 500 6272	distributor	retail-ready, verified-supplier, retail-ready, verified-supplier, bulk-discount	USA	5-10 days	Credit Card	Authorized distributor for major brands.	\N	500.00	\N	\N	\N	\N	\N	\N	0	\N
361	test-user-001	Supreme Electronics Inc.	https://www.supremeelectronicsin.com	csv	{}	active	2026-07-01 17:09:52.275955	t	verified	\N	\N	Patricia Collins	patricia.collins@supremeelectronicsinc.com	+86 700 7331	wholesale	bulk-discount, MOQ-high, wholesale-only, factory-direct, fast-shipping, dropship-ready	Italy	5-10 days	Net 60	Long-standing supplier with consistent quality.	\N	500.00	\N	\N	\N	\N	\N	\N	0	\N
363	test-user-001	Royal Phone Accessories Limited	https://www.royalphoneaccessorie.net	api	{}	active	2026-07-01 17:09:52.275955	t	verified	\N	\N	Lisa Suzuki	lisa.suzuki@royalphoneaccessorieslimited.com	+49 600 8983	manufacturer	private-label, custom-packaging, certified, bulk-discount, sample-available, fast-shipping	Poland	14-21 days	PayPal	Full OEM/ODM capabilities. ISO certified.	\N	100.00	\N	\N	\N	\N	\N	\N	0	\N
364	test-user-001	Omega Home Decor Enterprise	https://www.omegahomedecorenterp.com	feed	{}	active	2026-07-01 17:09:52.275955	t	verified	\N	\N	Xia Parker	xia.parker@omegahomedecorenterprise.com	+81 500 3959	dropshipper	dropship-ready, fast-shipping, global-shipping, MOQ-low, sample-available, private-label	Singapore	7-10 days	T/T	Automated dropshipping. No minimum order.	\N	200.00	\N	\N	\N	\N	\N	\N	0	\N
365	test-user-001	Royal Electronics Industries	https://www.royalelectronicsindu.com	feed	{}	active	2026-07-01 17:09:52.275955	t	verified	\N	\N	Daniel Park	daniel.park@royalelectronicsindustries.com	+81 200 2571	dropshipper	dropship-ready, fast-shipping, global-shipping, MOQ-low, sample-available, sample-available	India	3-7 days	Letter of Credit	Worldwide shipping with tracking. Fulfillment within 24h.	\N	\N	\N	\N	\N	\N	\N	\N	0	\N
366	test-user-001	Alpha Lighting Enterprise	https://www.alphalightingenterpr.org	csv	{}	active	2026-07-01 17:09:52.275955	t	verified	\N	\N	Emily Jones	emily.jones@alphalightingenterprise.com	+91 400 9712	dropshipper	dropship-ready, fast-shipping, global-shipping, MOQ-low, sample-available, bulk-discount	Australia	2-3 weeks	T/T	Automated dropshipping. No minimum order.	\N	500.00	\N	\N	\N	\N	\N	\N	0	\N
367	test-user-001	Vertex Crafts & Sewing Partners	https://www.vertexcraftssewingpa.com	custom	{}	active	2026-07-01 17:09:52.275955	t	verified	\N	\N	Mason Scott	mason.scott@vertexcraftssewingpartners.com	+91 400 8396	manufacturer	private-label, custom-packaging, certified, certified, fast-shipping, factory-direct	USA	7-12 days	Net 30	Full OEM/ODM capabilities. ISO certified.	\N	100.00	\N	\N	\N	\N	\N	\N	0	\N
368	test-user-001	Universal Jewelry & Accessories Holdings	https://www.universaljewelryacce.net	feed	{}	active	2026-07-01 17:09:52.275955	t	verified	\N	\N	James Clark	james.clark@universaljewelryaccessoriesholdings.com	+33 300 4254	wholesale	bulk-discount, MOQ-high, wholesale-only, factory-direct, premium, bulk-discount	Sri Lanka	1-2 weeks	T/T	Factory-direct pricing. Samples available.	\N	200.00	\N	\N	\N	\N	\N	\N	0	\N
369	test-user-001	Omega Electronics Enterprise	https://www.omegaelectronicsente.com	csv	{}	active	2026-07-01 17:09:52.275955	t	verified	\N	\N	Ashley Wilson	ashley.wilson@omegaelectronicsenterprise.com	+1 600 5544	dropshipper	dropship-ready, fast-shipping, global-shipping, MOQ-low, sample-available, sample-available	Sri Lanka	5-10 days	Net 60	Worldwide shipping with tracking. Fulfillment within 24h.	\N	200.00	\N	\N	\N	\N	\N	\N	0	\N
370	test-user-001	Nova Kitchen & Dining Trading Co.	https://www.novakitchendiningtra.org	api	{}	active	2026-07-01 17:09:52.275955	t	verified	\N	\N	Cynthia Wright	cynthia.wright@novakitchendiningtradingco.com	+91 600 6015	distributor	retail-ready, verified-supplier, organic-certified, free-samples, factory-direct	Sri Lanka	5-10 days	T/T	Authorized distributor for major brands.	\N	50.00	\N	\N	\N	\N	\N	\N	0	\N
371	test-user-001	Titan Jewelry & Accessories Limited	https://www.titanjewelryaccessor.net	csv	{}	active	2026-07-01 17:09:52.275955	t	verified	\N	\N	Paul Cruz	paul.cruz@titanjewelryaccessorieslimited.com	+86 200 2739	wholesale	bulk-discount, MOQ-high, wholesale-only, factory-direct, sample-available, certified	Japan	5-10 days	Wire Transfer	Factory-direct pricing. Samples available.	\N	\N	\N	\N	\N	\N	\N	\N	0	\N
372	test-user-001	Royal Furniture Supplies	https://www.royalfurnituresuppli.com	csv	{}	active	2026-07-01 17:09:52.275955	t	verified	\N	\N	Elizabeth Lee	elizabeth.lee@royalfurnituresupplies.com	+1 200 5040	manufacturer	private-label, custom-packaging, certified, MOQ-high, bulk-discount, custom-packaging	China	1-2 weeks	Net 60	Full OEM/ODM capabilities. ISO certified.	\N	\N	\N	\N	\N	\N	\N	\N	0	\N
373	test-user-001	Titan Beauty & Personal Care Company	https://www.titanbeautypersonalc.com	custom	{}	active	2026-07-01 17:09:52.275955	t	verified	\N	\N	Christopher Garcia	christopher.garcia@titanbeautypersonalcarecompany.com	+1 500 3722	dropshipper	dropship-ready, fast-shipping, global-shipping, MOQ-low, sample-available, sample-available	Vietnam	7-14 days	Credit Card	Worldwide shipping with tracking. Fulfillment within 24h.	\N	100.00	\N	\N	\N	\N	\N	\N	0	\N
374	test-user-001	Universal Watches Direct	https://www.universalwatchesdire.com	csv	{}	active	2026-07-01 17:09:52.275955	t	verified	\N	\N	Yuko Martinez	yuko.martinez@universalwatchesdirect.com	+86 300 9034	wholesale	bulk-discount, MOQ-high, wholesale-only, factory-direct, dropship-ready, free-samples	Australia	7-10 days	Western Union	Factory-direct pricing. Samples available.	\N	50.00	\N	\N	\N	\N	\N	\N	0	\N
375	test-user-001	Prime Camping & Hiking Group	https://www.primecampinghikinggr.com	api	{}	active	2026-07-01 17:09:52.275955	t	verified	\N	\N	Amanda Young	amanda.young@primecampinghikinggroup.com	+1 400 6962	wholesale	bulk-discount, MOQ-high, wholesale-only, factory-direct, certified, bulk-discount	Mexico	14-21 days	Net 60	Long-standing supplier with consistent quality.	\N	\N	\N	\N	\N	\N	\N	\N	0	\N
376	test-user-001	Royal Kitchen & Dining Trading Co.	https://www.royalkitchendiningtr.com	api	{}	active	2026-07-01 17:09:52.275955	t	verified	\N	\N	Joshua Turner	joshua.turner@royalkitchendiningtradingco.com	+1 700 7718	manufacturer	private-label, custom-packaging, certified, fast-shipping, wholesale-only, verified-supplier	Canada	15-30 days	Net 60	Full OEM/ODM capabilities. ISO certified.	\N	\N	\N	\N	\N	\N	\N	\N	0	\N
377	test-user-001	Summit Office Products Trading Co.	https://www.summitofficeproducts.com	api	{}	active	2026-07-01 17:09:52.275955	t	verified	\N	\N	Susan Taylor	susan.taylor@summitofficeproductstradingco.com	+33 200 1805	distributor	retail-ready, verified-supplier, retail-ready, fast-shipping, dropship-ready	Canada	5-7 days	Wire Transfer	Authorized distributor for major brands.	\N	500.00	\N	\N	\N	\N	\N	\N	0	\N
378	test-user-001	Zenith Office Products Sourcing	https://www.zenithofficeproducts.net	api	{}	active	2026-07-01 17:09:52.275955	t	verified	\N	\N	Ethan Khan	ethan.khan@zenithofficeproductssourcing.com	+86 200 5102	distributor	retail-ready, verified-supplier, certified, fast-shipping, verified-supplier	Australia	2-3 weeks	Net 60	Multi-brand distributor. Same-day dispatch.	\N	\N	\N	\N	\N	\N	\N	\N	0	\N
379	test-user-001	Global Phone Accessories Industries	https://www.globalphoneaccessori.com	feed	{}	active	2026-07-01 17:09:52.275955	t	verified	\N	\N	Nancy Park	nancy.park@globalphoneaccessoriesindustries.com	+33 500 9258	distributor	retail-ready, verified-supplier, fast-shipping, dropship-ready, organic-certified	Taiwan	7-14 days	Credit Card	Multi-brand distributor. Same-day dispatch.	\N	\N	\N	\N	\N	\N	\N	\N	0	\N
380	test-user-001	Royal Party Supplies Group	https://www.royalpartysuppliesgr.com	api	{}	active	2026-07-01 17:09:52.275955	t	verified	\N	\N	Sandra Yamamoto	sandra.yamamoto@royalpartysuppliesgroup.com	+49 200 8114	manufacturer	private-label, custom-packaging, certified, verified-supplier, free-samples, MOQ-low	UAE	2-3 weeks	PayPal + Net 30	In-house design team. Custom packaging available.	\N	100.00	\N	\N	\N	\N	\N	\N	0	\N
381	test-user-001	Atlas Toys & Hobbies Enterprise	https://www.atlastoyshobbiesente.org	csv	{}	active	2026-07-01 17:09:52.275955	t	verified	\N	\N	Satoshi Flores	satoshi.flores@atlastoyshobbiesenterprise.com	+86 300 8636	dropshipper	dropship-ready, fast-shipping, global-shipping, MOQ-low, sample-available, fast-shipping	UK	7-14 days	Net 60	Worldwide shipping with tracking. Fulfillment within 24h.	\N	50.00	\N	\N	\N	\N	\N	\N	0	\N
382	test-user-001	Prime Jewelry & Accessories Company	https://www.primejewelryaccessor.net	csv	{}	active	2026-07-01 17:09:52.275955	t	verified	\N	\N	Jeffrey Evans	jeffrey.evans@primejewelryaccessoriescompany.com	+49 200 4290	distributor	retail-ready, verified-supplier, retail-ready, premium, certified	Brazil	5-7 days	Letter of Credit	Authorized distributor for major brands.	\N	500.00	\N	\N	\N	\N	\N	\N	0	\N
383	test-user-001	Atlas Electronics Inc.	https://www.atlaselectronicsinc.org	api	{}	active	2026-07-01 17:09:52.275955	t	verified	\N	\N	Amanda Phillips	amanda.phillips@atlaselectronicsinc.com	+86 500 6036	manufacturer	private-label, custom-packaging, certified, fast-shipping, bulk-discount, private-label	UK	10-15 days	Net 60	In-house design team. Custom packaging available.	\N	\N	\N	\N	\N	\N	\N	\N	0	\N
384	test-user-001	Summit Watches Limited	https://www.summitwatcheslimited.net	feed	{}	active	2026-07-01 17:09:52.275955	t	verified	\N	\N	George Rivera	george.rivera@summitwatcheslimited.com	+91 300 9559	distributor	retail-ready, verified-supplier, certified, dropship-ready, wholesale-only	Hong Kong	3-7 days	Net 15	Authorized distributor for major brands.	\N	50.00	\N	\N	\N	\N	\N	\N	0	\N
385	test-user-001	Peak Beauty & Personal Care Solutions	https://www.peakbeautypersonalca.net	feed	{}	active	2026-07-01 17:09:52.275955	t	verified	\N	\N	Carlos Campbell	carlos.campbell@peakbeautypersonalcaresolutions.com	+81 300 9535	distributor	retail-ready, verified-supplier, bulk-discount, MOQ-high, factory-direct	Portugal	7-14 days	T/T	Multi-brand distributor. Same-day dispatch.	\N	1000.00	\N	\N	\N	\N	\N	\N	0	\N
386	test-user-001	Vertex Jewelry & Accessories Trading Co.	https://www.vertexjewelryaccesso.org	custom	{}	active	2026-07-01 17:09:52.275955	t	verified	\N	\N	Matthew Taylor	matthew.taylor@vertexjewelryaccessoriestradingco.com	+33 600 1055	dropshipper	dropship-ready, fast-shipping, global-shipping, MOQ-low, sample-available, white-label	Indonesia	1-2 weeks	Net 60	Automated dropshipping. No minimum order.	\N	1000.00	\N	\N	\N	\N	\N	\N	0	\N
387	test-user-001	Alpha Party Supplies International	https://www.alphapartysuppliesin.org	api	{}	active	2026-07-01 17:09:52.275955	t	verified	\N	\N	Lucas Scott	lucas.scott@alphapartysuppliesinternational.com	+81 400 8398	manufacturer	private-label, custom-packaging, certified, free-samples, wholesale-only, eco-friendly	France	7-10 days	Net 15	In-house design team. Custom packaging available.	\N	500.00	\N	\N	\N	\N	\N	\N	0	\N
388	test-user-001	Metro Furniture Limited	https://www.metrofurniturelimite.org	custom	{}	active	2026-07-01 17:09:52.275955	t	verified	\N	\N	Jessica Diaz	jessica.diaz@metrofurniturelimited.com	+49 600 9699	wholesale	bulk-discount, MOQ-high, wholesale-only, factory-direct, bulk-discount, white-label	Vietnam	1-2 weeks	Western Union	Factory-direct pricing. Samples available.	\N	200.00	\N	\N	\N	\N	\N	\N	0	\N
389	test-user-001	Elite Camping & Hiking Direct	https://www.elitecampinghikingdi.com	csv	{}	active	2026-07-01 17:09:52.275955	t	verified	\N	\N	Min Flores	min.flores@elitecampinghikingdirect.com	+86 300 5564	other	sample-available, white-label, custom-packaging, MOQ-low, MOQ-high	Philippines	5-7 days	Western Union	Curated product selection. Personal account manager.	\N	200.00	\N	\N	\N	\N	\N	\N	0	\N
390	test-user-001	Metro Party Supplies Supplies	https://www.metropartysuppliessu.org	csv	{}	active	2026-07-01 17:09:52.275955	t	verified	\N	\N	Rebecca Smith	rebecca.smith@metropartysuppliessupplies.com	+49 300 3934	dropshipper	dropship-ready, fast-shipping, global-shipping, MOQ-low, sample-available, MOQ-high	Mexico	7-10 days	Western Union	Automated dropshipping. No minimum order.	\N	200.00	\N	\N	\N	\N	\N	\N	0	\N
391	test-user-001	Premier Tools & Hardware Direct	https://www.premiertoolshardware.org	feed	{}	active	2026-07-01 17:09:52.275955	t	verified	\N	\N	Satoshi Anderson	satoshi.anderson@premiertoolshardwaredirect.com	+91 200 4558	manufacturer	private-label, custom-packaging, certified, bulk-discount, private-label, eco-friendly	UAE	10-15 days	Letter of Credit	Full OEM/ODM capabilities. ISO certified.	\N	1000.00	\N	\N	\N	\N	\N	\N	0	\N
392	test-user-001	Vertex Party Supplies Trading Co.	https://www.vertexpartysuppliest.net	csv	{}	active	2026-07-01 17:09:52.275955	t	verified	\N	\N	Maria Lee	maria.lee@vertexpartysuppliestradingco.com	+81 300 5189	distributor	retail-ready, verified-supplier, retail-ready, verified-supplier, private-label	South Korea	5-10 days	Letter of Credit	Authorized distributor for major brands.	\N	\N	\N	\N	\N	\N	\N	\N	0	\N
393	test-user-001	Pacific Eyewear Corp.	https://www.pacificeyewearcorp.com	csv	{}	active	2026-07-01 17:09:52.275955	t	verified	\N	\N	Michelle Martin	michelle.martin@pacificeyewearcorp.com	+49 600 8368	distributor	retail-ready, verified-supplier, premium, free-samples, fast-shipping	Netherlands	14-21 days	Letter of Credit	Authorized distributor for major brands.	\N	\N	\N	\N	\N	\N	\N	\N	0	\N
394	test-user-001	Royal Fashion Group	https://www.royalfashiongroup.org	csv	{}	active	2026-07-01 17:09:52.275955	t	verified	\N	\N	Charlotte Anderson	charlotte.anderson@royalfashiongroup.com	+33 200 4732	dropshipper	dropship-ready, fast-shipping, global-shipping, MOQ-low, sample-available, custom-packaging	Brazil	3-5 days	PayPal + Net 30	Automated dropshipping. No minimum order.	\N	200.00	\N	\N	\N	\N	\N	\N	0	\N
395	test-user-001	Peak Crafts & Sewing Inc.	https://www.peakcraftssewinginc.com	csv	{}	active	2026-07-01 17:09:52.275955	t	verified	\N	\N	Stephanie Wang	stephanie.wang@peakcraftssewinginc.com	+91 700 7278	distributor	retail-ready, verified-supplier, verified-supplier, organic-certified, premium	South Korea	3-7 days	PayPal	Multi-brand distributor. Same-day dispatch.	\N	\N	\N	\N	\N	\N	\N	\N	0	\N
396	test-user-001	Apex Pet Supplies Supplies	https://www.apexpetsuppliessuppl.com	api	{}	active	2026-07-01 17:09:52.275955	t	verified	\N	\N	Linda Adams	linda.adams@apexpetsuppliessupplies.com	+33 600 7200	manufacturer	private-label, custom-packaging, certified, global-shipping, custom-packaging, MOQ-low	India	10-15 days	Credit Card	In-house design team. Custom packaging available.	\N	200.00	\N	\N	\N	\N	\N	\N	0	\N
397	test-user-001	Pacific Crafts & Sewing Group	https://www.pacificcraftssewingg.net	csv	{}	active	2026-07-01 17:09:52.275955	t	verified	\N	\N	Lisa Yang	lisa.yang@pacificcraftssewinggroup.com	+91 700 8028	wholesale	bulk-discount, MOQ-high, wholesale-only, factory-direct, fast-shipping, dropship-ready	South Korea	3-5 days	Net 30	Long-standing supplier with consistent quality.	\N	500.00	\N	\N	\N	\N	\N	\N	0	\N
398	test-user-001	Global Tools & Hardware Inc.	https://www.globaltoolshardwarei.org	api	{}	active	2026-07-01 17:09:52.275955	t	verified	\N	\N	Richard Adams	richard.adams@globaltoolshardwareinc.com	+33 400 7861	manufacturer	private-label, custom-packaging, certified, MOQ-low, global-shipping, retail-ready	France	7-14 days	Letter of Credit	In-house design team. Custom packaging available.	\N	50.00	\N	\N	\N	\N	\N	\N	0	\N
399	test-user-001	Global Kitchen & Dining Sourcing	https://www.globalkitchendinings.com	custom	{}	active	2026-07-01 17:09:52.275955	t	verified	\N	\N	Jacob Torres	jacob.torres@globalkitchendiningsourcing.com	+86 600 1536	dropshipper	dropship-ready, fast-shipping, global-shipping, MOQ-low, sample-available, dropship-ready	France	7-12 days	Net 15	Worldwide shipping with tracking. Fulfillment within 24h.	\N	100.00	\N	\N	\N	\N	\N	\N	0	\N
479	test-user-001	Elite Baby Products Supplies	https://www.elitebabyproductssup.org	custom	{}	active	2026-07-01 17:09:52.297656	t	verified	\N	\N	Eric Hall	eric.hall@elitebabyproductssupplies.com	+1 500 7109	wholesale	bulk-discount, MOQ-high, wholesale-only, factory-direct, factory-direct, organic-certified	Vietnam	5-7 days	Net 15	Bulk orders only. MOQ applies.	\N	1000.00	\N	\N	\N	\N	\N	\N	0	\N
400	test-user-001	Titan Sports & Outdoors International	https://www.titansportsoutdoorsi.net	feed	{}	active	2026-07-01 17:09:52.275955	t	verified	\N	\N	Jung Johnson	jung.johnson@titansportsoutdoorsinternational.com	+81 700 8678	distributor	retail-ready, verified-supplier, MOQ-low, fast-shipping, white-label	Malaysia	5-7 days	Net 30	Multi-brand distributor. Same-day dispatch.	\N	100.00	\N	\N	\N	\N	\N	\N	0	\N
401	test-user-001	Peak Fashion International	https://www.peakfashioninternati.com	csv	{}	active	2026-07-01 17:09:52.275955	t	verified	\N	\N	Lisa Cruz	lisa.cruz@peakfashioninternational.com	+33 500 8268	manufacturer	private-label, custom-packaging, certified, bulk-discount, quality-assured, sample-available	Sri Lanka	5-10 days	Credit Card	In-house design team. Custom packaging available.	\N	\N	\N	\N	\N	\N	\N	\N	0	\N
402	test-user-001	Peak Automotive Holdings	https://www.peakautomotiveholdin.org	csv	{}	active	2026-07-01 17:09:52.275955	t	verified	\N	\N	Frank Thompson	frank.thompson@peakautomotiveholdings.com	+86 200 1850	distributor	retail-ready, verified-supplier, factory-direct, eco-friendly, verified-supplier	Sri Lanka	5-7 days	Net 30	Multi-brand distributor. Same-day dispatch.	\N	1000.00	\N	\N	\N	\N	\N	\N	0	\N
403	test-user-001	Omega Toys & Hobbies Corp.	https://www.omegatoyshobbiescorp.net	feed	{}	active	2026-07-01 17:09:52.275955	t	verified	\N	\N	William Clark	william.clark@omegatoyshobbiescorp.com	+1 400 6963	manufacturer	private-label, custom-packaging, certified, wholesale-only, fast-shipping, organic-certified	Brazil	7-12 days	PayPal + Net 30	In-house design team. Custom packaging available.	\N	50.00	\N	\N	\N	\N	\N	\N	0	\N
404	test-user-001	Pacific Fashion Holdings	https://www.pacificfashionholdin.com	feed	{}	active	2026-07-01 17:09:52.289418	t	verified	\N	\N	Angela Baker	angela.baker@pacificfashionholdings.com	+49 400 3170	distributor	retail-ready, verified-supplier, bulk-discount, free-samples, private-label	UAE	3-5 days	Net 60	Authorized distributor for major brands.	\N	\N	\N	\N	\N	\N	\N	\N	0	\N
405	test-user-001	Global Fashion Direct	https://www.globalfashiondirect.org	feed	{}	active	2026-07-01 17:09:52.289418	t	verified	\N	\N	Eric Allen	eric.allen@globalfashiondirect.com	+1 700 9741	other	sample-available, white-label, dropship-ready, fast-shipping, private-label	Taiwan	7-14 days	Net 60	Specialty supplier. Flexible terms.	\N	1000.00	\N	\N	\N	\N	\N	\N	0	\N
406	test-user-001	Pacific Sports & Outdoors Corp.	https://www.pacificsportsoutdoor.net	csv	{}	active	2026-07-01 17:09:52.289418	t	verified	\N	\N	Yuko Miller	yuko.miller@pacificsportsoutdoorscorp.com	+33 400 7218	manufacturer	private-label, custom-packaging, certified, MOQ-high, eco-friendly, custom-packaging	Hong Kong	14-21 days	Net 15	Full OEM/ODM capabilities. ISO certified.	\N	50.00	\N	\N	\N	\N	\N	\N	0	\N
407	test-user-001	Prime Kitchen & Dining Sourcing	https://www.primekitchendiningso.com	api	{}	active	2026-07-01 17:09:52.289418	t	verified	\N	\N	Rebecca Patel	rebecca.patel@primekitchendiningsourcing.com	+1 400 4201	wholesale	bulk-discount, MOQ-high, wholesale-only, factory-direct, MOQ-low, custom-packaging	Bangladesh	15-30 days	PayPal	Long-standing supplier with consistent quality.	\N	500.00	\N	\N	\N	\N	\N	\N	0	\N
408	test-user-001	Nova Tools & Hardware Solutions	https://www.novatoolshardwaresol.com	feed	{}	active	2026-07-01 17:09:52.289418	t	verified	\N	\N	Stephanie Torres	stephanie.torres@novatoolshardwaresolutions.com	+81 500 9319	distributor	retail-ready, verified-supplier, custom-packaging, MOQ-low, MOQ-high	Italy	1-2 weeks	PayPal + Net 30	Authorized distributor for major brands.	\N	500.00	\N	\N	\N	\N	\N	\N	0	\N
409	test-user-001	Universal Pet Supplies Inc.	https://www.universalpetsupplies.com	feed	{}	active	2026-07-01 17:09:52.289418	t	verified	\N	\N	Christopher Evans	christopher.evans@universalpetsuppliesinc.com	+44 600 5918	manufacturer	private-label, custom-packaging, certified, fast-shipping, custom-packaging, quality-assured	Japan	14-21 days	PayPal	Full OEM/ODM capabilities. ISO certified.	\N	500.00	\N	\N	\N	\N	\N	\N	0	\N
410	test-user-001	Delta Kitchen & Dining Group	https://www.deltakitchendininggr.org	feed	{}	active	2026-07-01 17:09:52.289418	t	verified	\N	\N	George Williams	george.williams@deltakitchendininggroup.com	+1 200 5835	manufacturer	private-label, custom-packaging, certified, sample-available, custom-packaging, wholesale-only	Hong Kong	2-3 weeks	Net 90	In-house design team. Custom packaging available.	\N	100.00	\N	\N	\N	\N	\N	\N	0	\N
411	test-user-001	Metro Kitchen & Dining Partners	https://www.metrokitchendiningpa.net	feed	{}	active	2026-07-01 17:09:52.289418	t	verified	\N	\N	Amy Thompson	amy.thompson@metrokitchendiningpartners.com	+33 700 5912	dropshipper	dropship-ready, fast-shipping, global-shipping, MOQ-low, sample-available, eco-friendly	Vietnam	3-7 days	Credit Card	Automated dropshipping. No minimum order.	\N	500.00	\N	\N	\N	\N	\N	\N	0	\N
412	test-user-001	Global Camping & Hiking Sourcing	https://www.globalcampinghikings.net	api	{}	active	2026-07-01 17:09:52.289418	t	verified	\N	\N	Carlos Anderson	carlos.anderson@globalcampinghikingsourcing.com	+81 700 1217	other	sample-available, white-label, eco-friendly, free-samples, verified-supplier	Bangladesh	3-7 days	Net 90	Curated product selection. Personal account manager.	\N	\N	\N	\N	\N	\N	\N	\N	0	\N
413	test-user-001	Elite Party Supplies Group	https://www.elitepartysuppliesgr.org	api	{}	active	2026-07-01 17:09:52.289418	t	verified	\N	\N	Chen Parker	chen.parker@elitepartysuppliesgroup.com	+33 400 6772	distributor	retail-ready, verified-supplier, private-label, dropship-ready, fast-shipping	Spain	10-15 days	Net 45	Multi-brand distributor. Same-day dispatch.	\N	\N	\N	\N	\N	\N	\N	\N	0	\N
414	test-user-001	Premier Crafts & Sewing Enterprise	https://www.premiercraftssewinge.com	custom	{}	active	2026-07-01 17:09:52.289418	t	verified	\N	\N	Nancy Evans	nancy.evans@premiercraftssewingenterprise.com	+86 300 3479	dropshipper	dropship-ready, fast-shipping, global-shipping, MOQ-low, sample-available, MOQ-low	Philippines	15-30 days	Western Union	Worldwide shipping with tracking. Fulfillment within 24h.	\N	100.00	\N	\N	\N	\N	\N	\N	0	\N
415	test-user-001	Apex Beauty & Personal Care Group	https://www.apexbeautypersonalca.net	custom	{}	active	2026-07-01 17:09:52.289418	t	verified	\N	\N	Richard Li	richard.li@apexbeautypersonalcaregroup.com	+86 700 2387	dropshipper	dropship-ready, fast-shipping, global-shipping, MOQ-low, sample-available, premium	Spain	14-21 days	Western Union	Worldwide shipping with tracking. Fulfillment within 24h.	\N	\N	\N	\N	\N	\N	\N	\N	0	\N
416	test-user-001	Royal Crafts & Sewing Industries	https://www.royalcraftssewingind.org	api	{}	active	2026-07-01 17:09:52.289418	t	verified	\N	\N	Daniel Walker	daniel.walker@royalcraftssewingindustries.com	+33 200 7235	other	sample-available, white-label, wholesale-only, fast-shipping, quality-assured	Taiwan	5-7 days	Western Union	Specialty supplier. Flexible terms.	\N	\N	\N	\N	\N	\N	\N	\N	0	\N
417	test-user-001	Atlas Party Supplies Trading Co.	https://www.atlaspartysuppliestr.org	custom	{}	active	2026-07-01 17:09:52.289418	t	verified	\N	\N	Jeffrey Hall	jeffrey.hall@atlaspartysuppliestradingco.com	+91 400 4069	distributor	retail-ready, verified-supplier, fast-shipping, sample-available, retail-ready	Indonesia	7-10 days	Net 30	Multi-brand distributor. Same-day dispatch.	\N	50.00	\N	\N	\N	\N	\N	\N	0	\N
418	test-user-001	Omega Furniture Sourcing	https://www.omegafurnituresourci.org	api	{}	active	2026-07-01 17:09:52.289418	t	verified	\N	\N	David Torres	david.torres@omegafurnituresourcing.com	+86 200 5388	distributor	retail-ready, verified-supplier, white-label, global-shipping, eco-friendly	China	5-7 days	Net 60	Multi-brand distributor. Same-day dispatch.	\N	\N	\N	\N	\N	\N	\N	\N	0	\N
419	test-user-001	Elite Crafts & Sewing Supplies	https://www.elitecraftssewingsup.com	custom	{}	active	2026-07-01 17:09:52.289418	t	verified	\N	\N	Patricia Jones	patricia.jones@elitecraftssewingsupplies.com	+33 700 9116	wholesale	bulk-discount, MOQ-high, wholesale-only, factory-direct, dropship-ready, custom-packaging	Portugal	5-10 days	Wire Transfer	Factory-direct pricing. Samples available.	\N	200.00	\N	\N	\N	\N	\N	\N	0	\N
420	test-user-001	Prime Crafts & Sewing International	https://www.primecraftssewingint.org	custom	{}	active	2026-07-01 17:09:52.289418	t	verified	\N	\N	Betty Allen	betty.allen@primecraftssewinginternational.com	+33 300 3474	other	sample-available, white-label, eco-friendly, wholesale-only, retail-ready	South Korea	15-30 days	Letter of Credit	Specialty supplier. Flexible terms.	\N	\N	\N	\N	\N	\N	\N	\N	0	\N
421	test-user-001	Omega Automotive Corp.	https://www.omegaautomotivecorp.com	custom	{}	active	2026-07-01 17:09:52.289418	t	verified	\N	\N	Mason Singh	mason.singh@omegaautomotivecorp.com	+81 200 4952	wholesale	bulk-discount, MOQ-high, wholesale-only, factory-direct, retail-ready, eco-friendly	South Korea	1-2 weeks	PayPal	Long-standing supplier with consistent quality.	\N	200.00	\N	\N	\N	\N	\N	\N	0	\N
422	test-user-001	Metro Lighting Sourcing	https://www.metrolightingsourcin.net	feed	{}	active	2026-07-01 17:09:52.289418	t	verified	\N	\N	Ronald White	ronald.white@metrolightingsourcing.com	+33 700 9737	dropshipper	dropship-ready, fast-shipping, global-shipping, MOQ-low, sample-available, dropship-ready	Taiwan	3-7 days	Net 60	Automated dropshipping. No minimum order.	\N	50.00	\N	\N	\N	\N	\N	\N	0	\N
423	test-user-001	Premier Phone Accessories Direct	https://www.premierphoneaccessor.net	csv	{}	active	2026-07-01 17:09:52.289418	t	verified	\N	\N	Eric Garcia	eric.garcia@premierphoneaccessoriesdirect.com	+1 600 9588	dropshipper	dropship-ready, fast-shipping, global-shipping, MOQ-low, sample-available, retail-ready	Brazil	2-3 weeks	PayPal	Automated dropshipping. No minimum order.	\N	100.00	\N	\N	\N	\N	\N	\N	0	\N
424	test-user-001	Elite Pet Supplies Corp.	https://www.elitepetsuppliescorp.org	feed	{}	active	2026-07-01 17:09:52.289418	t	verified	\N	\N	Gary Choi	gary.choi@elitepetsuppliescorp.com	+1 600 9535	dropshipper	dropship-ready, fast-shipping, global-shipping, MOQ-low, sample-available, eco-friendly	China	3-5 days	Wire Transfer	Automated dropshipping. No minimum order.	\N	100.00	\N	\N	\N	\N	\N	\N	0	\N
425	test-user-001	Global Watches Trading Co.	https://www.globalwatchestrading.org	api	{}	active	2026-07-01 17:09:52.289418	t	verified	\N	\N	Maria Allen	maria.allen@globalwatchestradingco.com	+1 400 7488	wholesale	bulk-discount, MOQ-high, wholesale-only, factory-direct, private-label, global-shipping	Spain	5-10 days	PayPal	Factory-direct pricing. Samples available.	\N	100.00	\N	\N	\N	\N	\N	\N	0	\N
426	test-user-001	Metro Health & Wellness Trading Co.	https://www.metrohealthwellnesst.org	custom	{}	active	2026-07-01 17:09:52.289418	t	verified	\N	\N	Jessica Harris	jessica.harris@metrohealthwellnesstradingco.com	+44 200 7309	other	sample-available, white-label, bulk-discount, global-shipping, eco-friendly	Poland	3-7 days	Net 60	Curated product selection. Personal account manager.	\N	50.00	\N	\N	\N	\N	\N	\N	0	\N
427	test-user-001	Vertex Kitchen & Dining Industries	https://www.vertexkitchendiningi.com	feed	{}	active	2026-07-01 17:09:52.289418	t	verified	\N	\N	Jung Nguyen	jung.nguyen@vertexkitchendiningindustries.com	+44 600 5174	manufacturer	private-label, custom-packaging, certified, retail-ready, fast-shipping, dropship-ready	Vietnam	1-2 weeks	Net 60	In-house design team. Custom packaging available.	\N	200.00	\N	\N	\N	\N	\N	\N	0	\N
428	test-user-001	Peak Furniture Inc.	https://www.peakfurnitureinc.org	custom	{}	active	2026-07-01 17:09:52.289418	t	verified	\N	\N	Betty Patel	betty.patel@peakfurnitureinc.com	+1 400 1735	dropshipper	dropship-ready, fast-shipping, global-shipping, MOQ-low, sample-available, private-label	Netherlands	15-30 days	Letter of Credit	Worldwide shipping with tracking. Fulfillment within 24h.	\N	50.00	\N	\N	\N	\N	\N	\N	0	\N
429	test-user-001	Peak Pet Supplies Corp.	https://www.peakpetsuppliescorp.net	csv	{}	active	2026-07-01 17:09:52.289418	t	verified	\N	\N	Andrew Singh	andrew.singh@peakpetsuppliescorp.com	+81 700 4784	distributor	retail-ready, verified-supplier, custom-packaging, private-label, certified	South Korea	2-3 weeks	Letter of Credit	Authorized distributor for major brands.	\N	100.00	\N	\N	\N	\N	\N	\N	0	\N
430	test-user-001	Apex Sports & Outdoors Holdings	https://www.apexsportsoutdoorsho.com	feed	{}	active	2026-07-01 17:09:52.289418	t	verified	\N	\N	Ethan Lopez	ethan.lopez@apexsportsoutdoorsholdings.com	+91 400 9639	distributor	retail-ready, verified-supplier, free-samples, premium, sample-available	UAE	7-14 days	Net 45	Multi-brand distributor. Same-day dispatch.	\N	500.00	\N	\N	\N	\N	\N	\N	0	\N
431	test-user-001	Metro Sports & Outdoors Group	https://www.metrosportsoutdoorsg.net	api	{}	active	2026-07-01 17:09:52.289418	t	verified	\N	\N	Andrew Evans	andrew.evans@metrosportsoutdoorsgroup.com	+86 300 6728	distributor	retail-ready, verified-supplier, global-shipping, verified-supplier, sample-available	Netherlands	3-7 days	Letter of Credit	Authorized distributor for major brands.	\N	50.00	\N	\N	\N	\N	\N	\N	0	\N
432	test-user-001	Atlas Kitchen & Dining Direct	https://www.atlaskitchendiningdi.org	custom	{}	active	2026-07-01 17:09:52.289418	t	verified	\N	\N	Carlos Flores	carlos.flores@atlaskitchendiningdirect.com	+33 400 7986	dropshipper	dropship-ready, fast-shipping, global-shipping, MOQ-low, sample-available, bulk-discount	Malaysia	1-2 weeks	Net 90	Automated dropshipping. No minimum order.	\N	\N	\N	\N	\N	\N	\N	\N	0	\N
433	test-user-001	Universal Kitchen & Dining Inc.	https://www.universalkitchendini.com	csv	{}	active	2026-07-01 17:09:52.289418	t	verified	\N	\N	James Mitchell	james.mitchell@universalkitchendininginc.com	+91 600 4090	manufacturer	private-label, custom-packaging, certified, MOQ-low, MOQ-high, quality-assured	Brazil	7-10 days	Credit Card	Full OEM/ODM capabilities. ISO certified.	\N	1000.00	\N	\N	\N	\N	\N	\N	0	\N
434	test-user-001	Summit Electronics Group	https://www.summitelectronicsgro.com	custom	{}	active	2026-07-01 17:09:52.289418	t	verified	\N	\N	Amanda Robinson	amanda.robinson@summitelectronicsgroup.com	+49 600 3398	wholesale	bulk-discount, MOQ-high, wholesale-only, factory-direct, premium, eco-friendly	UAE	5-10 days	PayPal	Factory-direct pricing. Samples available.	\N	\N	\N	\N	\N	\N	\N	\N	0	\N
435	test-user-001	Supreme Phone Accessories Direct	https://www.supremephoneaccessor.net	api	{}	active	2026-07-01 17:09:52.289418	t	verified	\N	\N	Timothy Phillips	timothy.phillips@supremephoneaccessoriesdirect.com	+33 600 1510	manufacturer	private-label, custom-packaging, certified, eco-friendly, dropship-ready, private-label	Philippines	5-10 days	PayPal + Net 30	Full OEM/ODM capabilities. ISO certified.	\N	100.00	\N	\N	\N	\N	\N	\N	0	\N
436	test-user-001	Global Sports & Outdoors Inc.	https://www.globalsportsoutdoors.net	feed	{}	active	2026-07-01 17:09:52.289418	t	verified	\N	\N	Sharon Campbell	sharon.campbell@globalsportsoutdoorsinc.com	+86 600 2535	other	sample-available, white-label, private-label, dropship-ready, factory-direct	Taiwan	1-2 weeks	Net 15	Specialty supplier. Flexible terms.	\N	50.00	\N	\N	\N	\N	\N	\N	0	\N
437	test-user-001	Delta Party Supplies Enterprise	https://www.deltapartysuppliesen.org	custom	{}	active	2026-07-01 17:09:52.289418	t	verified	\N	\N	Raj Lopez	raj.lopez@deltapartysuppliesenterprise.com	+91 500 2060	distributor	retail-ready, verified-supplier, organic-certified, bulk-discount, white-label	USA	2-3 weeks	Net 30	Authorized distributor for major brands.	\N	50.00	\N	\N	\N	\N	\N	\N	0	\N
438	test-user-001	Universal Crafts & Sewing Group	https://www.universalcraftssewin.net	csv	{}	active	2026-07-01 17:09:52.289418	t	verified	\N	\N	Jeffrey Garcia	jeffrey.garcia@universalcraftssewinggroup.com	+33 700 7199	dropshipper	dropship-ready, fast-shipping, global-shipping, MOQ-low, sample-available, global-shipping	Singapore	7-12 days	Net 15	Worldwide shipping with tracking. Fulfillment within 24h.	\N	100.00	\N	\N	\N	\N	\N	\N	0	\N
439	test-user-001	Global Electronics Enterprise	https://www.globalelectronicsent.com	csv	{}	active	2026-07-01 17:09:52.289418	t	verified	\N	\N	Satoshi Collins	satoshi.collins@globalelectronicsenterprise.com	+44 300 6412	wholesale	bulk-discount, MOQ-high, wholesale-only, factory-direct, factory-direct, eco-friendly	Mexico	7-12 days	Net 30	Long-standing supplier with consistent quality.	\N	200.00	\N	\N	\N	\N	\N	\N	0	\N
440	test-user-001	Metro Phone Accessories Enterprise	https://www.metrophoneaccessorie.org	feed	{}	active	2026-07-01 17:09:52.289418	t	verified	\N	\N	Noah Suzuki	noah.suzuki@metrophoneaccessoriesenterprise.com	+81 300 1539	wholesale	bulk-discount, MOQ-high, wholesale-only, factory-direct, free-samples, premium	Indonesia	5-7 days	Net 30	Long-standing supplier with consistent quality.	\N	\N	\N	\N	\N	\N	\N	\N	0	\N
441	test-user-001	Delta Crafts & Sewing Industries	https://www.deltacraftssewingind.org	feed	{}	active	2026-07-01 17:09:52.289418	t	verified	\N	\N	Patricia Parker	patricia.parker@deltacraftssewingindustries.com	+91 200 6905	distributor	retail-ready, verified-supplier, retail-ready, bulk-discount, MOQ-low	Poland	14-21 days	Western Union	Authorized distributor for major brands.	\N	200.00	\N	\N	\N	\N	\N	\N	0	\N
442	test-user-001	Titan Electronics Inc.	https://www.titanelectronicsinc.com	feed	{}	active	2026-07-01 17:09:52.289418	t	verified	\N	\N	John Young	john.young@titanelectronicsinc.com	+44 400 1371	dropshipper	dropship-ready, fast-shipping, global-shipping, MOQ-low, sample-available, MOQ-low	Japan	15-30 days	Letter of Credit	Worldwide shipping with tracking. Fulfillment within 24h.	\N	500.00	\N	\N	\N	\N	\N	\N	0	\N
443	test-user-001	Apex Phone Accessories Corp.	https://www.apexphoneaccessories.com	csv	{}	active	2026-07-01 17:09:52.289418	t	verified	\N	\N	Donald Wilson	donald.wilson@apexphoneaccessoriescorp.com	+44 600 7362	distributor	retail-ready, verified-supplier, bulk-discount, factory-direct, retail-ready	Spain	7-10 days	Letter of Credit	Authorized distributor for major brands.	\N	100.00	\N	\N	\N	\N	\N	\N	0	\N
444	test-user-001	Prime Furniture Sourcing	https://www.primefurnituresourci.com	api	{}	active	2026-07-01 17:09:52.289418	t	verified	\N	\N	Sarah Williams	sarah.williams@primefurnituresourcing.com	+44 600 5665	dropshipper	dropship-ready, fast-shipping, global-shipping, MOQ-low, sample-available, bulk-discount	Hong Kong	5-10 days	Net 45	Automated dropshipping. No minimum order.	\N	\N	\N	\N	\N	\N	\N	\N	0	\N
445	test-user-001	Titan Kitchen & Dining Inc.	https://www.titankitchendiningin.com	csv	{}	active	2026-07-01 17:09:52.289418	t	verified	\N	\N	Susan Rivera	susan.rivera@titankitchendininginc.com	+44 500 7126	manufacturer	private-label, custom-packaging, certified, premium, sample-available, eco-friendly	South Korea	7-14 days	Net 30	In-house design team. Custom packaging available.	\N	200.00	\N	\N	\N	\N	\N	\N	0	\N
446	test-user-001	Peak Toys & Hobbies Industries	https://www.peaktoyshobbiesindus.com	custom	{}	active	2026-07-01 17:09:52.289418	t	verified	\N	\N	Christopher Hernandez	christopher.hernandez@peaktoyshobbiesindustries.com	+44 600 3043	distributor	retail-ready, verified-supplier, bulk-discount, factory-direct, premium	Hong Kong	15-30 days	Wire Transfer	Authorized distributor for major brands.	\N	500.00	\N	\N	\N	\N	\N	\N	0	\N
447	test-user-001	Omega Beauty & Personal Care International	https://www.omegabeautypersonalc.net	custom	{}	active	2026-07-01 17:09:52.289418	t	verified	\N	\N	Michelle Turner	michelle.turner@omegabeautypersonalcareinternational.com	+86 400 8389	dropshipper	dropship-ready, fast-shipping, global-shipping, MOQ-low, sample-available, premium	Hong Kong	14-21 days	Net 15	Worldwide shipping with tracking. Fulfillment within 24h.	\N	\N	\N	\N	\N	\N	\N	\N	0	\N
448	test-user-001	Premier Lighting Industries	https://www.premierlightingindus.net	feed	{}	active	2026-07-01 17:09:52.289418	t	verified	\N	\N	Daniel Choi	daniel.choi@premierlightingindustries.com	+81 200 1592	manufacturer	private-label, custom-packaging, certified, MOQ-low, verified-supplier, eco-friendly	Bangladesh	3-7 days	Letter of Credit	Full OEM/ODM capabilities. ISO certified.	\N	\N	\N	\N	\N	\N	\N	\N	0	\N
449	test-user-001	Omega Phone Accessories International	https://www.omegaphoneaccessorie.org	csv	{}	active	2026-07-01 17:09:52.289418	t	verified	\N	\N	Timothy Phillips	timothy.phillips@omegaphoneaccessoriesinternational.com	+81 200 3296	distributor	retail-ready, verified-supplier, private-label, custom-packaging, white-label	Germany	3-5 days	Letter of Credit	Multi-brand distributor. Same-day dispatch.	\N	\N	\N	\N	\N	\N	\N	\N	0	\N
450	test-user-001	Zenith Tools & Hardware Limited	https://www.zenithtoolshardwarel.com	custom	{}	active	2026-07-01 17:09:52.289418	t	verified	\N	\N	Mary Clark	mary.clark@zenithtoolshardwarelimited.com	+1 200 7802	manufacturer	private-label, custom-packaging, certified, sample-available, certified, free-samples	Brazil	5-10 days	Net 30	Full OEM/ODM capabilities. ISO certified.	\N	100.00	\N	\N	\N	\N	\N	\N	0	\N
451	test-user-001	Atlas Sports & Outdoors Holdings	https://www.atlassportsoutdoorsh.com	api	{}	active	2026-07-01 17:09:52.289418	t	verified	\N	\N	Priya Martin	priya.martin@atlassportsoutdoorsholdings.com	+49 500 7431	distributor	retail-ready, verified-supplier, MOQ-high, MOQ-low, private-label	Philippines	15-30 days	Credit Card	Authorized distributor for major brands.	\N	100.00	\N	\N	\N	\N	\N	\N	0	\N
452	test-user-001	Universal Automotive Sourcing	https://www.universalautomotives.com	feed	{}	active	2026-07-01 17:09:52.289418	t	verified	\N	\N	Karen Zhang	karen.zhang@universalautomotivesourcing.com	+91 300 2346	dropshipper	dropship-ready, fast-shipping, global-shipping, MOQ-low, sample-available, certified	Spain	3-5 days	Letter of Credit	Automated dropshipping. No minimum order.	\N	200.00	\N	\N	\N	\N	\N	\N	0	\N
453	test-user-001	Metro Beauty & Personal Care Company	https://www.metrobeautypersonalc.com	api	{}	active	2026-07-01 17:09:52.289418	t	verified	\N	\N	Ronald Hall	ronald.hall@metrobeautypersonalcarecompany.com	+81 200 6945	dropshipper	dropship-ready, fast-shipping, global-shipping, MOQ-low, sample-available, organic-certified	Mexico	5-7 days	Letter of Credit	Automated dropshipping. No minimum order.	\N	100.00	\N	\N	\N	\N	\N	\N	0	\N
454	test-user-001	Apex Party Supplies Corp.	https://www.apexpartysuppliescor.org	custom	{}	active	2026-07-01 17:09:52.297656	t	verified	\N	\N	Charlotte Lee	charlotte.lee@apexpartysuppliescorp.com	+91 300 8031	dropshipper	dropship-ready, fast-shipping, global-shipping, MOQ-low, sample-available, dropship-ready	Netherlands	15-30 days	Credit Card	Worldwide shipping with tracking. Fulfillment within 24h.	\N	100.00	\N	\N	\N	\N	\N	\N	0	\N
455	test-user-001	Atlas Phone Accessories Partners	https://www.atlasphoneaccessorie.com	api	{}	active	2026-07-01 17:09:52.297656	t	verified	\N	\N	George Gomez	george.gomez@atlasphoneaccessoriespartners.com	+44 700 3510	manufacturer	private-label, custom-packaging, certified, fast-shipping, sample-available, dropship-ready	USA	5-7 days	PayPal	In-house design team. Custom packaging available.	\N	50.00	\N	\N	\N	\N	\N	\N	0	\N
456	test-user-001	Peak Camping & Hiking Limited	https://www.peakcampinghikinglim.org	custom	{}	active	2026-07-01 17:09:52.297656	t	verified	\N	\N	Steven Robinson	steven.robinson@peakcampinghikinglimited.com	+91 600 6172	wholesale	bulk-discount, MOQ-high, wholesale-only, factory-direct, private-label, dropship-ready	Vietnam	3-7 days	PayPal	Bulk orders only. MOQ applies.	\N	200.00	\N	\N	\N	\N	\N	\N	0	\N
457	test-user-001	Vertex Beauty & Personal Care Trading Co.	https://www.vertexbeautypersonal.com	feed	{}	active	2026-07-01 17:09:52.297656	t	verified	\N	\N	Anna Gomez	anna.gomez@vertexbeautypersonalcaretradingco.com	+1 500 4026	manufacturer	private-label, custom-packaging, certified, organic-certified, premium, white-label	Vietnam	3-5 days	Net 15	Full OEM/ODM capabilities. ISO certified.	\N	200.00	\N	\N	\N	\N	\N	\N	0	\N
458	test-user-001	Universal Eyewear Direct	https://www.universaleyeweardire.org	custom	{}	active	2026-07-01 17:09:52.297656	t	verified	\N	\N	Anthony Kim	anthony.kim@universaleyeweardirect.com	+86 500 5186	other	sample-available, white-label, organic-certified, white-label, custom-packaging	Vietnam	5-10 days	Credit Card	Curated product selection. Personal account manager.	\N	\N	\N	\N	\N	\N	\N	\N	0	\N
459	test-user-001	Supreme Party Supplies Trading Co.	https://www.supremepartysupplies.com	csv	{}	active	2026-07-01 17:09:52.297656	t	verified	\N	\N	Carol Singh	carol.singh@supremepartysuppliestradingco.com	+1 400 1849	other	sample-available, white-label, bulk-discount, quality-assured, custom-packaging	Bangladesh	2-3 weeks	Wire Transfer	Specialty supplier. Flexible terms.	\N	\N	\N	\N	\N	\N	\N	\N	0	\N
460	test-user-001	Elite Sports & Outdoors Holdings	https://www.elitesportsoutdoorsh.org	api	{}	active	2026-07-01 17:09:52.297656	t	verified	\N	\N	Dorothy Harris	dorothy.harris@elitesportsoutdoorsholdings.com	+33 500 4878	dropshipper	dropship-ready, fast-shipping, global-shipping, MOQ-low, sample-available, certified	Mexico	5-7 days	Net 90	Automated dropshipping. No minimum order.	\N	100.00	\N	\N	\N	\N	\N	\N	0	\N
461	test-user-001	Metro Jewelry & Accessories Sourcing	https://www.metrojewelryaccessor.org	csv	{}	active	2026-07-01 17:09:52.297656	t	verified	\N	\N	Andrew Miller	andrew.miller@metrojewelryaccessoriessourcing.com	+49 400 8519	dropshipper	dropship-ready, fast-shipping, global-shipping, MOQ-low, sample-available, verified-supplier	Netherlands	1-2 weeks	PayPal	Worldwide shipping with tracking. Fulfillment within 24h.	\N	500.00	\N	\N	\N	\N	\N	\N	0	\N
462	test-user-001	Premier Automotive Corp.	https://www.premierautomotivecor.org	feed	{}	active	2026-07-01 17:09:52.297656	t	verified	\N	\N	Joseph Choi	joseph.choi@premierautomotivecorp.com	+91 200 7518	other	sample-available, white-label, global-shipping, bulk-discount, factory-direct	Australia	3-5 days	Net 90	Curated product selection. Personal account manager.	\N	200.00	\N	\N	\N	\N	\N	\N	0	\N
463	test-user-001	Nova Sports & Outdoors Direct	https://www.novasportsoutdoorsdi.org	custom	{}	active	2026-07-01 17:09:52.297656	t	verified	\N	\N	Cynthia Yang	cynthia.yang@novasportsoutdoorsdirect.com	+91 300 8577	other	sample-available, white-label, global-shipping, custom-packaging, certified	China	2-3 weeks	Wire Transfer	Specialty supplier. Flexible terms.	\N	100.00	\N	\N	\N	\N	\N	\N	0	\N
464	test-user-001	Titan Toys & Hobbies Corp.	https://www.titantoyshobbiescorp.com	custom	{}	active	2026-07-01 17:09:52.297656	t	verified	\N	\N	Maria Suzuki	maria.suzuki@titantoyshobbiescorp.com	+49 400 2835	other	sample-available, white-label, global-shipping, sample-available, private-label	China	7-10 days	Net 90	Specialty supplier. Flexible terms.	\N	1000.00	\N	\N	\N	\N	\N	\N	0	\N
465	test-user-001	Alpha Furniture Supplies	https://www.alphafurnituresuppli.net	api	{}	active	2026-07-01 17:09:52.297656	t	verified	\N	\N	Christopher Tanaka	christopher.tanaka@alphafurnituresupplies.com	+49 500 5327	dropshipper	dropship-ready, fast-shipping, global-shipping, MOQ-low, sample-available, wholesale-only	Spain	5-10 days	Net 90	Automated dropshipping. No minimum order.	\N	100.00	\N	\N	\N	\N	\N	\N	0	\N
466	test-user-001	Delta Office Products Partners	https://www.deltaofficeproductsp.net	custom	{}	active	2026-07-01 17:09:52.297656	t	verified	\N	\N	John Campbell	john.campbell@deltaofficeproductspartners.com	+33 300 4091	dropshipper	dropship-ready, fast-shipping, global-shipping, MOQ-low, sample-available, MOQ-low	Germany	5-7 days	Letter of Credit	Worldwide shipping with tracking. Fulfillment within 24h.	\N	200.00	\N	\N	\N	\N	\N	\N	0	\N
467	test-user-001	Elite Automotive Company	https://www.eliteautomotivecompa.net	custom	{}	active	2026-07-01 17:09:52.297656	t	verified	\N	\N	Hiroshi Evans	hiroshi.evans@eliteautomotivecompany.com	+91 400 4179	manufacturer	private-label, custom-packaging, certified, MOQ-low, wholesale-only, bulk-discount	Canada	10-15 days	Letter of Credit	Full OEM/ODM capabilities. ISO certified.	\N	1000.00	\N	\N	\N	\N	\N	\N	0	\N
468	test-user-001	Prime Baby Products International	https://www.primebabyproductsint.net	custom	{}	active	2026-07-01 17:09:52.297656	t	verified	\N	\N	Amy Cruz	amy.cruz@primebabyproductsinternational.com	+1 200 3604	other	sample-available, white-label, dropship-ready, retail-ready, factory-direct	Netherlands	5-10 days	Credit Card	Curated product selection. Personal account manager.	\N	500.00	\N	\N	\N	\N	\N	\N	0	\N
469	test-user-001	Premier Fashion Limited	https://www.premierfashionlimite.net	csv	{}	active	2026-07-01 17:09:52.297656	t	verified	\N	\N	James Adams	james.adams@premierfashionlimited.com	+86 600 6499	distributor	retail-ready, verified-supplier, certified, premium, white-label	Spain	7-14 days	Net 45	Authorized distributor for major brands.	\N	\N	\N	\N	\N	\N	\N	\N	0	\N
470	test-user-001	Royal Lighting Solutions	https://www.royallightingsolutio.com	custom	{}	active	2026-07-01 17:09:52.297656	t	verified	\N	\N	Sophia Jones	sophia.jones@royallightingsolutions.com	+44 600 6382	distributor	retail-ready, verified-supplier, fast-shipping, eco-friendly, factory-direct	Italy	10-15 days	Western Union	Authorized distributor for major brands.	\N	200.00	\N	\N	\N	\N	\N	\N	0	\N
471	test-user-001	Summit Party Supplies Partners	https://www.summitpartysuppliesp.net	api	{}	active	2026-07-01 17:09:52.297656	t	verified	\N	\N	Emily Nguyen	emily.nguyen@summitpartysuppliespartners.com	+33 200 2322	other	sample-available, white-label, white-label, certified, premium	Malaysia	15-30 days	Net 30	Specialty supplier. Flexible terms.	\N	200.00	\N	\N	\N	\N	\N	\N	0	\N
472	test-user-001	Alpha Office Products Direct	https://www.alphaofficeproductsd.net	api	{}	active	2026-07-01 17:09:52.297656	t	verified	\N	\N	Kevin Moore	kevin.moore@alphaofficeproductsdirect.com	+33 200 4495	dropshipper	dropship-ready, fast-shipping, global-shipping, MOQ-low, sample-available, MOQ-high	Vietnam	14-21 days	Net 60	Automated dropshipping. No minimum order.	\N	50.00	\N	\N	\N	\N	\N	\N	0	\N
473	test-user-001	Universal Office Products Direct	https://www.universalofficeprodu.net	custom	{}	active	2026-07-01 17:09:52.297656	t	verified	\N	\N	Min Flores	min.flores@universalofficeproductsdirect.com	+49 600 4649	other	sample-available, white-label, fast-shipping, premium, verified-supplier	Spain	7-12 days	Letter of Credit	Specialty supplier. Flexible terms.	\N	\N	\N	\N	\N	\N	\N	\N	0	\N
474	test-user-001	Alpha Fashion Direct	https://www.alphafashiondirect.org	feed	{}	active	2026-07-01 17:09:52.297656	t	verified	\N	\N	Ahmed Collins	ahmed.collins@alphafashiondirect.com	+86 700 8127	other	sample-available, white-label, global-shipping, free-samples, verified-supplier	Mexico	2-3 weeks	Net 60	Specialty supplier. Flexible terms.	\N	1000.00	\N	\N	\N	\N	\N	\N	0	\N
475	test-user-001	Universal Phone Accessories Sourcing	https://www.universalphoneaccess.com	api	{}	active	2026-07-01 17:09:52.297656	t	verified	\N	\N	Ahmed Suzuki	ahmed.suzuki@universalphoneaccessoriessourcing.com	+49 400 2929	distributor	retail-ready, verified-supplier, eco-friendly, certified, custom-packaging	India	7-12 days	Letter of Credit	Multi-brand distributor. Same-day dispatch.	\N	1000.00	\N	\N	\N	\N	\N	\N	0	\N
476	test-user-001	Alpha Toys & Hobbies Group	https://www.alphatoyshobbiesgrou.org	custom	{}	active	2026-07-01 17:09:52.297656	t	verified	\N	\N	Nancy Li	nancy.li@alphatoyshobbiesgroup.com	+86 600 3941	dropshipper	dropship-ready, fast-shipping, global-shipping, MOQ-low, sample-available, free-samples	UAE	7-14 days	T/T	Automated dropshipping. No minimum order.	\N	50.00	\N	\N	\N	\N	\N	\N	0	\N
477	test-user-001	Pacific Electronics Inc.	https://www.pacificelectronicsin.net	csv	{}	active	2026-07-01 17:09:52.297656	t	verified	\N	\N	Jessica Phillips	jessica.phillips@pacificelectronicsinc.com	+81 300 2703	wholesale	bulk-discount, MOQ-high, wholesale-only, factory-direct, eco-friendly, MOQ-high	UAE	5-10 days	Western Union	Long-standing supplier with consistent quality.	\N	50.00	\N	\N	\N	\N	\N	\N	0	\N
478	test-user-001	Delta Toys & Hobbies Holdings	https://www.deltatoyshobbieshold.org	csv	{}	active	2026-07-01 17:09:52.297656	t	verified	\N	\N	Nicholas Anderson	nicholas.anderson@deltatoyshobbiesholdings.com	+91 500 2968	other	sample-available, white-label, global-shipping, fast-shipping, dropship-ready	Canada	14-21 days	Wire Transfer	Specialty supplier. Flexible terms.	\N	50.00	\N	\N	\N	\N	\N	\N	0	\N
480	test-user-001	Global Furniture Limited	https://www.globalfurniturelimit.net	csv	{}	active	2026-07-01 17:09:52.297656	t	verified	\N	\N	Raj Diaz	raj.diaz@globalfurniturelimited.com	+33 700 3697	wholesale	bulk-discount, MOQ-high, wholesale-only, factory-direct, wholesale-only, eco-friendly	Hong Kong	5-7 days	Net 15	Long-standing supplier with consistent quality.	\N	500.00	\N	\N	\N	\N	\N	\N	0	\N
481	test-user-001	Omega Lighting Enterprise	https://www.omegalightingenterpr.com	api	{}	active	2026-07-01 17:09:52.297656	t	verified	\N	\N	Priya Tanaka	priya.tanaka@omegalightingenterprise.com	+33 400 4678	other	sample-available, white-label, fast-shipping, bulk-discount, white-label	Thailand	7-14 days	Net 45	Curated product selection. Personal account manager.	\N	1000.00	\N	\N	\N	\N	\N	\N	0	\N
482	test-user-001	Omega Watches Limited	https://www.omegawatcheslimited.org	custom	{}	active	2026-07-01 17:09:52.297656	t	verified	\N	\N	Noah Choi	noah.choi@omegawatcheslimited.com	+44 200 1707	other	sample-available, white-label, MOQ-high, fast-shipping, white-label	UAE	1-2 weeks	Net 15	Specialty supplier. Flexible terms.	\N	100.00	\N	\N	\N	\N	\N	\N	0	\N
483	test-user-001	Apex Furniture Inc.	https://www.apexfurnitureinc.com	csv	{}	active	2026-07-01 17:09:52.297656	t	verified	\N	\N	Raj Scott	raj.scott@apexfurnitureinc.com	+1 400 8688	other	sample-available, white-label, eco-friendly, dropship-ready, MOQ-high	France	5-7 days	T/T	Specialty supplier. Flexible terms.	\N	\N	\N	\N	\N	\N	\N	\N	0	\N
484	test-user-001	Zenith Health & Wellness Sourcing	https://www.zenithhealthwellness.com	feed	{}	active	2026-07-01 17:09:52.297656	t	verified	\N	\N	Anthony Green	anthony.green@zenithhealthwellnesssourcing.com	+44 600 2769	dropshipper	dropship-ready, fast-shipping, global-shipping, MOQ-low, sample-available, MOQ-low	Australia	5-7 days	Wire Transfer	Automated dropshipping. No minimum order.	\N	200.00	\N	\N	\N	\N	\N	\N	0	\N
485	test-user-001	Delta Sports & Outdoors Trading Co.	https://www.deltasportsoutdoorst.net	api	{}	active	2026-07-01 17:09:52.297656	t	verified	\N	\N	Ryan Chen	ryan.chen@deltasportsoutdoorstradingco.com	+33 600 6312	other	sample-available, white-label, premium, certified, global-shipping	Hong Kong	7-10 days	Net 30	Specialty supplier. Flexible terms.	\N	50.00	\N	\N	\N	\N	\N	\N	0	\N
486	test-user-001	Elite Fashion Supplies	https://www.elitefashionsupplies.com	custom	{}	active	2026-07-01 17:09:52.297656	t	verified	\N	\N	Jennifer Reyes	jennifer.reyes@elitefashionsupplies.com	+33 300 6269	wholesale	bulk-discount, MOQ-high, wholesale-only, factory-direct, white-label, MOQ-low	Japan	3-5 days	T/T	Long-standing supplier with consistent quality.	\N	200.00	\N	\N	\N	\N	\N	\N	0	\N
487	test-user-001	Summit Phone Accessories Group	https://www.summitphoneaccessori.org	feed	{}	active	2026-07-01 17:09:52.297656	t	verified	\N	\N	Aiko Martinez	aiko.martinez@summitphoneaccessoriesgroup.com	+44 600 4083	other	sample-available, white-label, MOQ-low, retail-ready, free-samples	India	1-2 weeks	Letter of Credit	Curated product selection. Personal account manager.	\N	100.00	\N	\N	\N	\N	\N	\N	0	\N
488	test-user-001	Summit Fashion Corp.	https://www.summitfashioncorp.org	custom	{}	active	2026-07-01 17:09:52.297656	t	verified	\N	\N	Sharon Patel	sharon.patel@summitfashioncorp.com	+44 200 4536	distributor	retail-ready, verified-supplier, certified, quality-assured, sample-available	Portugal	3-5 days	PayPal + Net 30	Multi-brand distributor. Same-day dispatch.	\N	100.00	\N	\N	\N	\N	\N	\N	0	\N
489	test-user-001	Titan Phone Accessories Sourcing	https://www.titanphoneaccessorie.com	feed	{}	active	2026-07-01 17:09:52.297656	t	verified	\N	\N	Ethan Carter	ethan.carter@titanphoneaccessoriessourcing.com	+91 400 5061	other	sample-available, white-label, private-label, verified-supplier, dropship-ready	Australia	7-12 days	Net 90	Specialty supplier. Flexible terms.	\N	\N	\N	\N	\N	\N	\N	\N	0	\N
490	test-user-001	Premier Furniture Trading Co.	https://www.premierfurnituretrad.org	custom	{}	active	2026-07-01 17:09:52.297656	t	verified	\N	\N	Ethan King	ethan.king@premierfurnituretradingco.com	+86 500 4938	other	sample-available, white-label, eco-friendly, custom-packaging, MOQ-low	Philippines	14-21 days	Net 45	Curated product selection. Personal account manager.	\N	1000.00	\N	\N	\N	\N	\N	\N	0	\N
491	test-user-001	Titan Automotive Sourcing	https://www.titanautomotivesourc.com	csv	{}	active	2026-07-01 17:09:52.297656	t	verified	\N	\N	Raj Gonzalez	raj.gonzalez@titanautomotivesourcing.com	+91 700 4938	dropshipper	dropship-ready, fast-shipping, global-shipping, MOQ-low, sample-available, fast-shipping	Netherlands	3-5 days	Net 90	Worldwide shipping with tracking. Fulfillment within 24h.	\N	500.00	\N	\N	\N	\N	\N	\N	0	\N
492	test-user-001	Supreme Furniture Sourcing	https://www.supremefurnituresour.net	api	{}	active	2026-07-01 17:09:52.297656	t	verified	\N	\N	Raj Parker	raj.parker@supremefurnituresourcing.com	+49 300 6828	manufacturer	private-label, custom-packaging, certified, global-shipping, free-samples, premium	Sri Lanka	2-3 weeks	PayPal	Full OEM/ODM capabilities. ISO certified.	\N	50.00	\N	\N	\N	\N	\N	\N	0	\N
493	test-user-001	Titan Tools & Hardware Industries	https://www.titantoolshardwarein.net	api	{}	active	2026-07-01 17:09:52.297656	t	verified	\N	\N	Sandra Smith	sandra.smith@titantoolshardwareindustries.com	+86 700 7798	manufacturer	private-label, custom-packaging, certified, private-label, white-label, bulk-discount	UK	3-5 days	Wire Transfer	Full OEM/ODM capabilities. ISO certified.	\N	50.00	\N	\N	\N	\N	\N	\N	0	\N
494	test-user-001	Atlas Lighting Solutions	https://www.atlaslightingsolutio.net	custom	{}	active	2026-07-01 17:09:52.297656	t	verified	\N	\N	Hiroshi Li	hiroshi.li@atlaslightingsolutions.com	+49 300 6750	other	sample-available, white-label, MOQ-low, private-label, premium	Brazil	7-14 days	Net 90	Curated product selection. Personal account manager.	\N	\N	\N	\N	\N	\N	\N	\N	0	\N
495	test-user-001	Supreme Office Products Solutions	https://www.supremeofficeproduct.org	api	{}	active	2026-07-01 17:09:52.297656	t	verified	\N	\N	Susan Flores	susan.flores@supremeofficeproductssolutions.com	+49 300 8602	manufacturer	private-label, custom-packaging, certified, wholesale-only, sample-available, fast-shipping	Sri Lanka	7-12 days	PayPal	Full OEM/ODM capabilities. ISO certified.	\N	100.00	\N	\N	\N	\N	\N	\N	0	\N
496	test-user-001	Royal Tools & Hardware Enterprise	https://www.royaltoolshardwareen.com	api	{}	active	2026-07-01 17:09:52.297656	t	verified	\N	\N	Charlotte Yang	charlotte.yang@royaltoolshardwareenterprise.com	+1 500 4393	dropshipper	dropship-ready, fast-shipping, global-shipping, MOQ-low, sample-available, MOQ-high	Spain	3-5 days	Net 60	Automated dropshipping. No minimum order.	\N	1000.00	\N	\N	\N	\N	\N	\N	0	\N
497	test-user-001	Supreme Crafts & Sewing Company	https://www.supremecraftssewingc.net	custom	{}	active	2026-07-01 17:09:52.297656	t	verified	\N	\N	Michael Moore	michael.moore@supremecraftssewingcompany.com	+44 200 2079	distributor	retail-ready, verified-supplier, fast-shipping, global-shipping, white-label	Taiwan	1-2 weeks	PayPal	Authorized distributor for major brands.	\N	\N	\N	\N	\N	\N	\N	\N	0	\N
498	test-user-001	Nova Toys & Hobbies Limited	https://www.novatoyshobbieslimit.com	csv	{}	active	2026-07-01 17:09:52.297656	t	verified	\N	\N	Ryan Baker	ryan.baker@novatoyshobbieslimited.com	+44 600 1058	manufacturer	private-label, custom-packaging, certified, MOQ-low, sample-available, verified-supplier	Hong Kong	7-14 days	Net 30	In-house design team. Custom packaging available.	\N	50.00	\N	\N	\N	\N	\N	\N	0	\N
499	test-user-001	Pacific Lighting Trading Co.	https://www.pacificlightingtradi.org	csv	{}	active	2026-07-01 17:09:52.297656	t	verified	\N	\N	Angela Edwards	angela.edwards@pacificlightingtradingco.com	+44 500 4980	other	sample-available, white-label, MOQ-low, quality-assured, free-samples	Bangladesh	15-30 days	PayPal	Curated product selection. Personal account manager.	\N	200.00	\N	\N	\N	\N	\N	\N	0	\N
500	test-user-001	Zenith Lighting Supplies	https://www.zenithlightingsuppli.net	custom	{}	active	2026-07-01 17:09:52.297656	t	verified	\N	\N	Joshua Allen	joshua.allen@zenithlightingsupplies.com	+1 700 4099	distributor	retail-ready, verified-supplier, fast-shipping, premium, factory-direct	UAE	10-15 days	PayPal + Net 30	Authorized distributor for major brands.	\N	500.00	\N	\N	\N	\N	\N	\N	0	\N
501	test-user-001	Prime Phone Accessories International	https://www.primephoneaccessorie.org	custom	{}	active	2026-07-01 17:09:52.297656	t	verified	\N	\N	Matthew Flores	matthew.flores@primephoneaccessoriesinternational.com	+81 300 6520	wholesale	bulk-discount, MOQ-high, wholesale-only, factory-direct, factory-direct, MOQ-low	China	1-2 weeks	Net 30	Long-standing supplier with consistent quality.	\N	50.00	\N	\N	\N	\N	\N	\N	0	\N
502	test-user-001	Supreme Toys & Hobbies Enterprise	https://www.supremetoyshobbiesen.org	api	{}	active	2026-07-01 17:09:52.297656	t	verified	\N	\N	Stephanie Chen	stephanie.chen@supremetoyshobbiesenterprise.com	+91 200 2662	distributor	retail-ready, verified-supplier, certified, MOQ-low, global-shipping	France	3-7 days	Western Union	Authorized distributor for major brands.	\N	200.00	\N	\N	\N	\N	\N	\N	0	\N
503	test-user-001	Apex Watches International	https://www.apexwatchesinternati.com	custom	{}	active	2026-07-01 17:09:52.297656	t	verified	\N	\N	Angela Smith	angela.smith@apexwatchesinternational.com	+33 700 2061	wholesale	bulk-discount, MOQ-high, wholesale-only, factory-direct, dropship-ready, white-label	UK	1-2 weeks	Net 30	Long-standing supplier with consistent quality.	\N	1000.00	\N	\N	\N	\N	\N	\N	0	\N
504	test-user-001	Apex Crafts & Sewing Solutions	https://www.apexcraftssewingsolu.net	feed	{}	active	2026-07-01 17:09:52.304866	t	verified	\N	\N	Helen Diaz	helen.diaz@apexcraftssewingsolutions.com	+1 600 6508	other	sample-available, white-label, factory-direct, sample-available, global-shipping	Singapore	10-15 days	Credit Card	Specialty supplier. Flexible terms.	\N	500.00	\N	\N	\N	\N	\N	\N	0	\N
505	test-user-001	Zenith Party Supplies Direct	https://www.zenithpartysuppliesd.net	api	{}	active	2026-07-01 17:09:52.304866	t	verified	\N	\N	Kevin Liu	kevin.liu@zenithpartysuppliesdirect.com	+33 700 4288	distributor	retail-ready, verified-supplier, free-samples, wholesale-only, white-label	Australia	3-7 days	Letter of Credit	Authorized distributor for major brands.	\N	100.00	\N	\N	\N	\N	\N	\N	0	\N
506	test-user-001	Alpha Crafts & Sewing Limited	https://www.alphacraftssewinglim.net	custom	{}	active	2026-07-01 17:09:52.304866	t	verified	\N	\N	Matthew Collins	matthew.collins@alphacraftssewinglimited.com	+33 200 3958	wholesale	bulk-discount, MOQ-high, wholesale-only, factory-direct, MOQ-low, premium	France	14-21 days	Net 30	Factory-direct pricing. Samples available.	\N	50.00	\N	\N	\N	\N	\N	\N	0	\N
507	test-user-001	Nova Watches Trading Co.	https://www.novawatchestradingco.com	custom	{}	active	2026-07-01 17:09:52.304866	t	verified	\N	\N	Isabella Clark	isabella.clark@novawatchestradingco.com	+49 700 8972	dropshipper	dropship-ready, fast-shipping, global-shipping, MOQ-low, sample-available, MOQ-high	Japan	3-5 days	T/T	Automated dropshipping. No minimum order.	\N	200.00	\N	\N	\N	\N	\N	\N	0	\N
508	test-user-001	Universal Lighting Holdings	https://www.universallightinghol.net	feed	{}	active	2026-07-01 17:09:52.304866	t	verified	\N	\N	Ryan Campbell	ryan.campbell@universallightingholdings.com	+33 500 4761	dropshipper	dropship-ready, fast-shipping, global-shipping, MOQ-low, sample-available, private-label	Sri Lanka	5-7 days	Net 45	Automated dropshipping. No minimum order.	\N	1000.00	\N	\N	\N	\N	\N	\N	0	\N
509	test-user-001	Peak Phone Accessories Solutions	https://www.peakphoneaccessories.org	custom	{}	active	2026-07-01 17:09:52.304866	t	verified	\N	\N	Helen Brown	helen.brown@peakphoneaccessoriessolutions.com	+1 400 9049	other	sample-available, white-label, wholesale-only, fast-shipping, dropship-ready	Indonesia	3-5 days	Wire Transfer	Specialty supplier. Flexible terms.	\N	1000.00	\N	\N	\N	\N	\N	\N	0	\N
510	test-user-001	Atlas Beauty & Personal Care International	https://www.atlasbeautypersonalc.com	feed	{}	active	2026-07-01 17:09:52.304866	t	verified	\N	\N	Lucas Thompson	lucas.thompson@atlasbeautypersonalcareinternational.com	+81 400 5294	wholesale	bulk-discount, MOQ-high, wholesale-only, factory-direct, free-samples, fast-shipping	UK	7-14 days	Western Union	Bulk orders only. MOQ applies.	\N	\N	\N	\N	\N	\N	\N	\N	0	\N
511	test-user-001	Delta Pet Supplies Limited	https://www.deltapetsupplieslimi.net	csv	{}	active	2026-07-01 17:09:52.304866	t	verified	\N	\N	Kevin Tanaka	kevin.tanaka@deltapetsupplieslimited.com	+44 600 6668	dropshipper	dropship-ready, fast-shipping, global-shipping, MOQ-low, sample-available, fast-shipping	Mexico	7-10 days	Net 90	Automated dropshipping. No minimum order.	\N	100.00	\N	\N	\N	\N	\N	\N	0	\N
512	test-user-001	Summit Sports & Outdoors Corp.	https://www.summitsportsoutdoors.net	api	{}	active	2026-07-01 17:09:52.304866	t	verified	\N	\N	Jennifer Baker	jennifer.baker@summitsportsoutdoorscorp.com	+81 600 8547	other	sample-available, white-label, certified, bulk-discount, wholesale-only	Japan	5-7 days	Net 30	Specialty supplier. Flexible terms.	\N	\N	\N	\N	\N	\N	\N	\N	0	\N
513	test-user-001	Peak Lighting Group	https://www.peaklightinggroup.net	custom	{}	active	2026-07-01 17:09:52.304866	t	verified	\N	\N	Stephanie Yang	stephanie.yang@peaklightinggroup.com	+81 400 9871	dropshipper	dropship-ready, fast-shipping, global-shipping, MOQ-low, sample-available, private-label	Malaysia	7-12 days	Net 90	Worldwide shipping with tracking. Fulfillment within 24h.	\N	200.00	\N	\N	\N	\N	\N	\N	0	\N
514	test-user-001	Vertex Lighting Partners	https://www.vertexlightingpartne.com	csv	{}	active	2026-07-01 17:09:52.304866	t	verified	\N	\N	Margaret Singh	margaret.singh@vertexlightingpartners.com	+81 700 7388	dropshipper	dropship-ready, fast-shipping, global-shipping, MOQ-low, sample-available, sample-available	Spain	1-2 weeks	PayPal	Automated dropshipping. No minimum order.	\N	1000.00	\N	\N	\N	\N	\N	\N	0	\N
515	test-user-001	Delta Phone Accessories Industries	https://www.deltaphoneaccessorie.com	api	{}	active	2026-07-01 17:09:52.304866	t	verified	\N	\N	Joseph Rodriguez	joseph.rodriguez@deltaphoneaccessoriesindustries.com	+44 400 2779	wholesale	bulk-discount, MOQ-high, wholesale-only, factory-direct, wholesale-only, certified	China	1-2 weeks	Net 90	Bulk orders only. MOQ applies.	\N	\N	\N	\N	\N	\N	\N	\N	0	\N
516	test-user-001	Nova Lighting Solutions	https://www.novalightingsolution.net	custom	{}	active	2026-07-01 17:09:52.304866	t	verified	\N	\N	Mark Lee	mark.lee@novalightingsolutions.com	+86 500 6237	other	sample-available, white-label, bulk-discount, organic-certified, white-label	UK	10-15 days	Net 60	Curated product selection. Personal account manager.	\N	500.00	\N	\N	\N	\N	\N	\N	0	\N
517	test-user-001	Elite Stationery Group	https://www.elitestationerygroup.net	csv	{}	active	2026-07-01 17:09:52.304866	t	verified	\N	\N	Helen Li	helen.li@elitestationerygroup.com	+81 300 9867	manufacturer	private-label, custom-packaging, certified, private-label, MOQ-low, quality-assured	Indonesia	14-21 days	Net 90	In-house design team. Custom packaging available.	\N	\N	\N	\N	\N	\N	\N	\N	0	\N
518	test-user-001	Prime Toys & Hobbies Limited	https://www.primetoyshobbieslimi.com	api	{}	active	2026-07-01 17:09:52.304866	t	verified	\N	\N	Gary Collins	gary.collins@primetoyshobbieslimited.com	+91 500 3287	wholesale	bulk-discount, MOQ-high, wholesale-only, factory-direct, MOQ-low, dropship-ready	Japan	14-21 days	Net 45	Bulk orders only. MOQ applies.	\N	\N	\N	\N	\N	\N	\N	\N	0	\N
519	test-user-001	Apex Lighting Inc.	https://www.apexlightinginc.net	custom	{}	active	2026-07-01 17:09:52.304866	t	verified	\N	\N	George Hernandez	george.hernandez@apexlightinginc.com	+49 400 9369	wholesale	bulk-discount, MOQ-high, wholesale-only, factory-direct, fast-shipping, factory-direct	Taiwan	10-15 days	Wire Transfer	Factory-direct pricing. Samples available.	\N	\N	\N	\N	\N	\N	\N	\N	0	\N
520	test-user-001	Metro Toys & Hobbies Solutions	https://www.metrotoyshobbiessolu.net	api	{}	active	2026-07-01 17:09:52.304866	t	verified	\N	\N	Kenneth Lee	kenneth.lee@metrotoyshobbiessolutions.com	+81 600 8233	dropshipper	dropship-ready, fast-shipping, global-shipping, MOQ-low, sample-available, eco-friendly	Singapore	7-10 days	PayPal	Worldwide shipping with tracking. Fulfillment within 24h.	\N	500.00	\N	\N	\N	\N	\N	\N	0	\N
521	test-user-001	Zenith Sports & Outdoors Enterprise	https://www.zenithsportsoutdoors.org	custom	{}	active	2026-07-01 17:09:52.304866	t	verified	\N	\N	Paul Hernandez	paul.hernandez@zenithsportsoutdoorsenterprise.com	+44 200 9102	wholesale	bulk-discount, MOQ-high, wholesale-only, factory-direct, private-label, custom-packaging	Philippines	15-30 days	PayPal + Net 30	Long-standing supplier with consistent quality.	\N	50.00	\N	\N	\N	\N	\N	\N	0	\N
522	test-user-001	Alpha Pet Supplies Company	https://www.alphapetsuppliescomp.org	feed	{}	active	2026-07-01 17:09:52.304866	t	verified	\N	\N	Amy Nguyen	amy.nguyen@alphapetsuppliescompany.com	+49 400 7463	wholesale	bulk-discount, MOQ-high, wholesale-only, factory-direct, factory-direct, organic-certified	Australia	7-12 days	Credit Card	Factory-direct pricing. Samples available.	\N	200.00	\N	\N	\N	\N	\N	\N	0	\N
523	test-user-001	Prime Sports & Outdoors Trading Co.	https://www.primesportsoutdoorst.com	custom	{}	active	2026-07-01 17:09:52.304866	t	verified	\N	\N	Noah Walker	noah.walker@primesportsoutdoorstradingco.com	+81 400 8339	dropshipper	dropship-ready, fast-shipping, global-shipping, MOQ-low, sample-available, certified	Japan	7-14 days	Western Union	Automated dropshipping. No minimum order.	\N	\N	\N	\N	\N	\N	\N	\N	0	\N
524	test-user-001	Zenith Beauty & Personal Care Trading Co.	https://www.zenithbeautypersonal.org	feed	{}	active	2026-07-01 17:09:52.304866	t	verified	\N	\N	Yuko Scott	yuko.scott@zenithbeautypersonalcaretradingco.com	+49 300 5262	distributor	retail-ready, verified-supplier, quality-assured, dropship-ready, premium	Hong Kong	5-7 days	Net 60	Multi-brand distributor. Same-day dispatch.	\N	\N	\N	\N	\N	\N	\N	\N	0	\N
525	test-user-001	Summit Toys & Hobbies Group	https://www.summittoyshobbiesgro.net	feed	{}	active	2026-07-01 17:09:52.304866	t	verified	\N	\N	Timothy Chen	timothy.chen@summittoyshobbiesgroup.com	+44 700 2984	other	sample-available, white-label, certified, retail-ready, free-samples	Germany	7-14 days	Western Union	Specialty supplier. Flexible terms.	\N	500.00	\N	\N	\N	\N	\N	\N	0	\N
526	test-user-001	Zenith Phone Accessories Solutions	https://www.zenithphoneaccessori.net	feed	{}	active	2026-07-01 17:09:52.304866	t	verified	\N	\N	Andrew King	andrew.king@zenithphoneaccessoriessolutions.com	+33 400 8346	wholesale	bulk-discount, MOQ-high, wholesale-only, factory-direct, private-label, verified-supplier	Mexico	5-10 days	Credit Card	Long-standing supplier with consistent quality.	\N	\N	\N	\N	\N	\N	\N	\N	0	\N
527	test-user-001	Royal Toys & Hobbies Limited	https://www.royaltoyshobbieslimi.com	feed	{}	active	2026-07-01 17:09:52.304866	t	verified	\N	\N	Joseph Clark	joseph.clark@royaltoyshobbieslimited.com	+81 700 3230	dropshipper	dropship-ready, fast-shipping, global-shipping, MOQ-low, sample-available, free-samples	Philippines	1-2 weeks	Net 15	Worldwide shipping with tracking. Fulfillment within 24h.	\N	500.00	\N	\N	\N	\N	\N	\N	0	\N
528	test-user-001	Atlas Eyewear International	https://www.atlaseyewearinternat.net	custom	{}	active	2026-07-01 17:09:52.304866	t	verified	\N	\N	Chen Chen	chen.chen@atlaseyewearinternational.com	+91 500 6121	distributor	retail-ready, verified-supplier, private-label, quality-assured, white-label	Spain	7-10 days	PayPal	Authorized distributor for major brands.	\N	1000.00	\N	\N	\N	\N	\N	\N	0	\N
529	test-user-001	Delta Beauty & Personal Care Partners	https://www.deltabeautypersonalc.org	csv	{}	active	2026-07-01 17:09:52.304866	t	verified	\N	\N	Yuko Williams	yuko.williams@deltabeautypersonalcarepartners.com	+33 500 4940	distributor	retail-ready, verified-supplier, factory-direct, MOQ-low, fast-shipping	Turkey	7-14 days	Letter of Credit	Authorized distributor for major brands.	\N	\N	\N	\N	\N	\N	\N	\N	0	\N
530	test-user-001	Omega Pet Supplies Industries	https://www.omegapetsuppliesindu.org	csv	{}	active	2026-07-01 17:09:52.304866	t	verified	\N	\N	Charlotte Davis	charlotte.davis@omegapetsuppliesindustries.com	+91 600 8555	distributor	retail-ready, verified-supplier, bulk-discount, certified, MOQ-low	Portugal	7-10 days	PayPal	Multi-brand distributor. Same-day dispatch.	\N	50.00	\N	\N	\N	\N	\N	\N	0	\N
531	test-user-001	Prime Pet Supplies Supplies	https://www.primepetsuppliessupp.com	custom	{}	active	2026-07-01 17:09:52.304866	t	verified	\N	\N	Eric Khan	eric.khan@primepetsuppliessupplies.com	+49 600 7562	other	sample-available, white-label, private-label, certified, wholesale-only	Singapore	7-10 days	Western Union	Specialty supplier. Flexible terms.	\N	100.00	\N	\N	\N	\N	\N	\N	0	\N
532	test-user-001	Summit Eyewear Holdings	https://www.summiteyewearholding.net	api	{}	active	2026-07-01 17:09:52.304866	t	verified	\N	\N	Satoshi Reyes	satoshi.reyes@summiteyewearholdings.com	+1 500 4442	other	sample-available, white-label, quality-assured, retail-ready, bulk-discount	Indonesia	2-3 weeks	Net 30	Specialty supplier. Flexible terms.	\N	500.00	\N	\N	\N	\N	\N	\N	0	\N
533	test-user-001	Pacific Pet Supplies International	https://www.pacificpetsuppliesin.com	custom	{}	active	2026-07-01 17:09:52.304866	t	verified	\N	\N	Donald Liu	donald.liu@pacificpetsuppliesinternational.com	+44 400 7840	other	sample-available, white-label, certified, white-label, premium	Vietnam	1-2 weeks	Net 90	Specialty supplier. Flexible terms.	\N	\N	\N	\N	\N	\N	\N	\N	0	\N
\.


--
-- Data for Name: vero_audit_log; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.vero_audit_log (id, user_id, product_id, submitted_brand, matched_vero_brand, match_method, outcome, override_by, override_reason, created_at) FROM stdin;
\.


--
-- Data for Name: vero_brand_aliases; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.vero_brand_aliases (id, canonical_brand, alias, created_at) FROM stdin;
1	Hewlett-Packard	HP	2026-04-05 17:19:49.544884
2	Louis Vuitton	LV	2026-04-05 17:19:49.544884
3	Louis Vuitton	LVMH	2026-04-05 17:19:49.544884
4	Ralph Lauren	Polo Ralph Lauren	2026-04-05 17:19:49.544884
5	The North Face	TNF	2026-04-05 17:19:49.544884
6	Under Armour	UA	2026-04-05 17:19:49.544884
7	Abercrombie & Fitch	A&F	2026-04-05 17:19:49.544884
8	Procter & Gamble	P&G	2026-04-05 17:19:49.544884
9	Johnson & Johnson	J&J	2026-04-05 17:19:49.544884
10	Dolce & Gabbana	D&G	2026-04-05 17:19:49.544884
11	Yves Saint Laurent	YSL	2026-04-05 17:19:49.544884
12	Christian Dior	Dior	2026-04-05 17:19:49.544884
13	Bayerische Motoren Werke	BMW	2026-04-05 17:19:49.544884
14	General Electric	GE	2026-04-05 17:19:49.544884
15	International Business Machines	IBM	2026-04-05 17:19:49.544884
16	LVMH Moët Hennessy	LVMH	2026-04-05 17:19:49.544884
17	Harley-Davidson	Harley Davidson	2026-04-05 17:19:49.544884
18	Mercedes-Benz	Mercedes Benz	2026-04-05 17:19:49.544884
19	Rolls-Royce	Rolls Royce	2026-04-05 17:19:49.544884
20	Land Rover	LandRover	2026-04-05 17:19:49.544884
21	Ray-Ban	RayBan	2026-04-05 17:19:49.544884
22	Coca-Cola	Coke	2026-04-05 17:19:49.544884
23	Levi Strauss	Levis	2026-04-05 17:19:49.544884
24	Levi Strauss	Levi's	2026-04-05 17:19:49.544884
25	Estée Lauder	Estee Lauder	2026-04-05 17:19:49.544884
26	Lancôme	Lancome	2026-04-05 17:19:49.544884
27	Hermès	Hermes	2026-04-05 17:19:49.544884
28	Bulgari	Bvlgari	2026-04-05 17:19:49.544884
29	Cartier	Cartier Paris	2026-04-05 17:19:49.544884
30	Nintendo	Nintendo Co	2026-04-05 17:19:49.544884
31	Beats by Dre	Beats	2026-04-05 17:19:49.544884
32	Bang & Olufsen	B&O	2026-04-05 17:19:49.544884
\.


--
-- Data for Name: vero_list; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.vero_list (id, user_id, type, value, platform, reason, is_active, created_at) FROM stdin;
1	test-user-001	brand	Beats by Dre	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:11.884393
2	test-user-001	brand	Arduino	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.054826
3	test-user-001	brand	Intuit	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.069441
4	test-user-001	brand	Under Armour	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.074556
5	test-user-001	brand	Abercrombie & Fitch	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.079855
6	test-user-001	brand	Lucasfilm	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.084887
7	test-user-001	brand	Star Wars	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.09029
8	test-user-001	brand	LEGO	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.094926
9	test-user-001	brand	Funko	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.098951
10	test-user-001	brand	Good Smile Company	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.103902
11	test-user-001	brand	Porsche	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.108239
12	test-user-001	brand	General Motors	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.112701
13	test-user-001	brand	Jaguar	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.117583
14	test-user-001	brand	Land Rover	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.123092
15	test-user-001	brand	Delorean	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.127633
16	test-user-001	brand	Bombardier	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.131487
17	test-user-001	brand	MAC Cosmetics	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.134928
18	test-user-001	brand	Dermalogica	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.139845
19	test-user-001	brand	Dollar Shave Club	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.143766
20	test-user-001	brand	Amway	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.155494
21	test-user-001	brand	It Works	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.159325
22	test-user-001	brand	Forever Living	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.163774
23	test-user-001	brand	Alessi	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.167665
24	test-user-001	brand	All Saints	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.172442
25	test-user-001	brand	American Eagle Outfitters	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.176161
26	test-user-001	brand	Axon	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.180665
27	test-user-001	brand	Taser	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.184389
28	test-user-001	brand	Benchmade	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.188155
29	test-user-001	brand	Bloomberg	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.192866
30	test-user-001	brand	Brother International	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.197496
31	test-user-001	brand	Caterpillar	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.201591
32	test-user-001	brand	Hugo Boss	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.206177
33	test-user-001	brand	Juul	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.210342
34	test-user-001	brand	Monster Energy	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.21487
35	test-user-001	brand	Philips Norelco	\N	Grooming - VeRO participant	t	2026-06-30 00:10:12.218861
36	test-user-001	brand	Asus	\N	Technology - VeRO participant	t	2026-06-30 00:10:12.222439
37	test-user-001	brand	Audio-Technica	\N	Audio - VeRO participant	t	2026-06-30 00:10:12.226242
38	test-user-001	brand	Jack Wolfskin	\N	Outdoor fashion - VeRO participant	t	2026-06-30 00:10:12.229878
39	test-user-001	brand	DeLonghi	\N	Kitchen - VeRO participant	t	2026-06-30 00:10:12.233537
40	test-user-001	brand	Buck Knives	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.236553
41	test-user-001	brand	Car-Freshner	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.240942
42	test-user-001	brand	Chandler Tool	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.24518
43	test-user-001	brand	Chloé	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.248369
44	test-user-001	brand	Coway	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.252653
45	test-user-001	brand	Dansko	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.256911
46	test-user-001	brand	Gerber Childrenswear	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.260736
47	test-user-001	brand	Gibson	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.263818
48	test-user-001	brand	Gretsch	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.267354
49	test-user-001	brand	GUNNAR Optiks	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.271175
50	test-user-001	brand	iFixit	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.275397
51	test-user-001	brand	Incipio	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.279433
52	test-user-001	brand	Jabra	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.283244
53	test-user-001	brand	GN Netcom	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.287655
54	test-user-001	brand	Jemella	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.290928
55	test-user-001	brand	Kirby	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.294213
56	test-user-001	brand	Moon Boot	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.297173
57	test-user-001	brand	Technica	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.30062
58	test-user-001	brand	TechSmith	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.304152
59	test-user-001	brand	Telebrands	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.307554
60	test-user-001	brand	The Richemont Group	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.311187
61	test-user-001	brand	Tiffany & Co	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.315641
62	test-user-001	brand	Tommie Copper	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.319394
63	test-user-001	brand	Nordstrom	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.323247
64	test-user-001	brand	Levi Strauss	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.326577
65	test-user-001	brand	Michael Kors	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.330812
66	test-user-001	brand	Oakley	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.334068
67	test-user-001	brand	Swarovski	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.337552
68	test-user-001	brand	Dr. Martens	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.341356
69	test-user-001	brand	Fitbit	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.345926
70	test-user-001	brand	Volkswagen	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.351654
71	test-user-001	brand	Rolex Watches	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.356008
72	test-user-001	brand	Omega Watches	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.359472
73	test-user-001	brand	FIFA	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.363233
74	test-user-001	brand	Vans	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.366797
75	test-user-001	brand	Issey Miyake	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.369811
76	test-user-001	brand	TaylorMade	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.373926
77	test-user-001	brand	NARS	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.378121
78	test-user-001	brand	La Mer	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.382549
79	test-user-001	brand	Sunday Riley	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.386023
80	test-user-001	brand	Velcro	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.389967
81	test-user-001	brand	Onesie	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.393162
82	test-user-001	brand	GoPro Hero	\N	Brand advisory — listing allowed with caution	t	2026-06-30 00:10:12.397095
83	test-user-001	brand	Garmin Watch	\N	Brand advisory — listing allowed with caution	t	2026-06-30 00:10:12.399907
84	test-user-001	brand	replica	\N	Counterfeit indicator — listing allowed	t	2026-06-30 00:10:12.403842
85	test-user-001	brand	knockoff	\N	Counterfeit indicator — listing allowed	t	2026-06-30 00:10:12.407424
86	test-user-001	brand	knock off	\N	Counterfeit indicator — listing allowed	t	2026-06-30 00:10:12.41099
87	test-user-001	brand	fake	\N	Counterfeit indicator — listing allowed	t	2026-06-30 00:10:12.414582
88	test-user-001	brand	counterfeit	\N	Counterfeit indicator — listing allowed	t	2026-06-30 00:10:12.418484
89	test-user-001	brand	imitation	\N	Counterfeit indicator — listing allowed	t	2026-06-30 00:10:12.421954
90	test-user-001	brand	1:1 copy	\N	Counterfeit indicator — listing allowed	t	2026-06-30 00:10:12.425177
91	test-user-001	brand	mirror copy	\N	Counterfeit indicator — listing allowed	t	2026-06-30 00:10:12.428173
92	test-user-001	brand	not original	\N	Counterfeit indicator — listing allowed	t	2026-06-30 00:10:12.432258
93	test-user-001	brand	unauthorized	\N	Counterfeit indicator — listing allowed	t	2026-06-30 00:10:12.435332
94	test-user-001	brand	inspired by	\N	Counterfeit indicator	t	2026-06-30 00:10:12.438701
95	test-user-001	brand	style of	\N	Counterfeit indicator	t	2026-06-30 00:10:12.442384
96	test-user-001	brand	like authentic	\N	Counterfeit indicator	t	2026-06-30 00:10:12.446279
97	test-user-001	brand	designer inspired	\N	Counterfeit indicator	t	2026-06-30 00:10:12.453566
98	test-user-001	brand	AAA quality	\N	Counterfeit grade indicator	t	2026-06-30 00:10:12.458954
99	test-user-001	brand	Sonos	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.46194
100	test-user-001	brand	bootleg	\N	Counterfeit indicator — listing allowed	t	2026-06-30 00:10:12.466268
101	test-user-001	brand	pirated	\N	Counterfeit indicator — listing allowed	t	2026-06-30 00:10:12.469995
102	test-user-001	brand	super copy	\N	Counterfeit indicator — listing allowed	t	2026-06-30 00:10:12.472839
103	test-user-001	brand	dupes	\N	Counterfeit indicator	t	2026-06-30 00:10:12.476321
104	test-user-001	brand	dupe	\N	Counterfeit indicator	t	2026-06-30 00:10:12.479457
105	test-user-001	brand	OEM copy	\N	Counterfeit indicator	t	2026-06-30 00:10:12.483202
106	test-user-001	brand	grade A copy	\N	Counterfeit indicator	t	2026-06-30 00:10:12.489341
107	test-user-001	brand	unbranded alternative	\N	Counterfeit indicator	t	2026-06-30 00:10:12.495368
108	test-user-001	brand	Louis Vuitton	\N	Luxury goods - aggressive IP enforcement	t	2026-06-30 00:10:12.498411
109	test-user-001	brand	Gucci	\N	Luxury goods - VeRO participant	t	2026-06-30 00:10:12.501747
110	test-user-001	brand	Chanel	\N	Luxury goods - VeRO participant	t	2026-06-30 00:10:12.506296
111	test-user-001	brand	Prada	\N	Luxury goods - VeRO participant	t	2026-06-30 00:10:12.511565
112	test-user-001	brand	Hermès	\N	Luxury goods - VeRO participant	t	2026-06-30 00:10:12.515893
113	test-user-001	brand	Hermes	\N	Luxury goods - VeRO participant	t	2026-06-30 00:10:12.520303
114	test-user-001	brand	Burberry	\N	Luxury goods - VeRO participant	t	2026-06-30 00:10:12.524258
115	test-user-001	brand	Dior	\N	Luxury goods - VeRO participant	t	2026-06-30 00:10:12.5298
116	test-user-001	brand	Armani	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.532754
117	test-user-001	brand	Apple	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.536501
118	test-user-001	brand	Bose	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.540316
119	test-user-001	brand	Balenciaga	\N	Luxury goods - VeRO participant	t	2026-06-30 00:10:12.544162
120	test-user-001	brand	Givenchy	\N	Luxury goods - VeRO participant	t	2026-06-30 00:10:12.548576
121	test-user-001	brand	Fendi	\N	Luxury goods - VeRO participant	t	2026-06-30 00:10:12.552532
122	test-user-001	brand	Valentino	\N	Luxury goods - VeRO participant	t	2026-06-30 00:10:12.555778
123	test-user-001	brand	Saint Laurent	\N	Luxury goods - VeRO participant	t	2026-06-30 00:10:12.559814
124	test-user-001	brand	Bottega Veneta	\N	Luxury goods - VeRO participant	t	2026-06-30 00:10:12.562654
125	test-user-001	brand	Cartier	\N	Luxury goods - VeRO participant	t	2026-06-30 00:10:12.56569
126	test-user-001	brand	Tiffany	\N	Jewelry - VeRO participant	t	2026-06-30 00:10:12.569217
127	test-user-001	brand	Rolex	\N	Watches - aggressive VeRO enforcement	t	2026-06-30 00:10:12.573004
128	test-user-001	brand	Omega	\N	Watches - VeRO participant	t	2026-06-30 00:10:12.576159
129	test-user-001	brand	TAG Heuer	\N	Watches - VeRO participant	t	2026-06-30 00:10:12.579161
130	test-user-001	brand	Patek Philippe	\N	Watches - VeRO participant	t	2026-06-30 00:10:12.582249
131	test-user-001	brand	Breitling	\N	Watches - VeRO participant	t	2026-06-30 00:10:12.585512
132	test-user-001	brand	Lacoste	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.588285
133	test-user-001	brand	Calvin Klein	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.591034
134	test-user-001	brand	Kate Spade	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.594135
135	test-user-001	brand	Patagonia	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.598156
136	test-user-001	brand	The North Face	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.600795
137	test-user-001	brand	Estée Lauder	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.603916
138	test-user-001	brand	Ray-Ban	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.607316
139	test-user-001	brand	Sony	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.610798
140	test-user-001	brand	Philips	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.613886
141	test-user-001	brand	Microsoft	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.616504
142	test-user-001	brand	Nintendo	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.619586
143	test-user-001	brand	Dyson	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.623395
144	test-user-001	brand	GoPro	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.626555
145	test-user-001	brand	DJI	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.629444
146	test-user-001	brand	Nike	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.632253
147	test-user-001	brand	Adidas	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.635779
148	test-user-001	brand	Canon	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.639913
149	test-user-001	brand	Garmin	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.64363
150	test-user-001	brand	JBL	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.647721
151	test-user-001	brand	Hugo Boss	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.651821
152	test-user-001	brand	Charlotte Tilbury	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.654986
153	test-user-001	brand	Tommy Hilfiger	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.658119
154	test-user-001	brand	Tom Ford	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.661181
155	test-user-001	brand	Nikon	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.664596
156	test-user-001	brand	Ralph Lauren	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.667404
157	test-user-001	brand	Puma	\N	Sportswear - VeRO participant	t	2026-06-30 00:10:12.670619
158	test-user-001	brand	Coach	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.673589
159	test-user-001	brand	New Balance	\N	Sportswear - VeRO participant	t	2026-06-30 00:10:12.677764
160	test-user-001	brand	Reebok	\N	Sportswear - VeRO participant	t	2026-06-30 00:10:12.680811
161	test-user-001	brand	Columbia	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.684823
162	test-user-001	brand	Samsung	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.687763
163	test-user-001	brand	Jo Malone	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.691313
164	test-user-001	brand	Estee Lauder	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.694767
165	test-user-001	brand	Clinique	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.697822
166	test-user-001	brand	Lancôme	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.700664
167	test-user-001	brand	Lancome	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.703784
168	test-user-001	brand	Pandora	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.70691
169	test-user-001	brand	Creed	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.710151
170	test-user-001	brand	Kiehl's	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.713132
171	test-user-001	brand	Urban Decay	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.717148
172	test-user-001	brand	BMW	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.720204
173	test-user-001	brand	Yankee Candle	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.723238
174	test-user-001	brand	Benefit Cosmetics	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.726613
175	test-user-001	brand	Dolce & Gabbana	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.730581
176	test-user-001	brand	Lululemon	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.734
177	test-user-001	brand	Ford	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.737514
178	test-user-001	brand	Fred Perry	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.740645
179	test-user-001	brand	Jimmy Choo	\N	Luxury goods - VeRO participant	t	2026-06-30 00:10:12.745277
180	test-user-001	brand	Christian Louboutin	\N	Luxury goods - VeRO participant	t	2026-06-30 00:10:12.749198
181	test-user-001	brand	Montblanc	\N	Luxury goods - VeRO participant	t	2026-06-30 00:10:12.752878
182	test-user-001	brand	Bvlgari	\N	Luxury goods - VeRO participant	t	2026-06-30 00:10:12.755869
183	test-user-001	brand	Supreme	\N	Streetwear - VeRO participant	t	2026-06-30 00:10:12.760438
184	test-user-001	brand	Stone Island	\N	Fashion - VeRO participant	t	2026-06-30 00:10:12.763345
185	test-user-001	brand	Moncler	\N	Fashion - VeRO participant	t	2026-06-30 00:10:12.766387
186	test-user-001	brand	John Deere	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.770171
187	test-user-001	brand	Weber	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.77311
188	test-user-001	brand	KitchenAid	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.77583
189	test-user-001	brand	Cuisinart	\N	Kitchen - VeRO participant	t	2026-06-30 00:10:12.778546
190	test-user-001	brand	Yeti	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.782462
191	test-user-001	brand	Stanley	\N	Drinkware - VeRO participant	t	2026-06-30 00:10:12.785262
192	test-user-001	brand	Marvel	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.788505
193	test-user-001	brand	DC Comics	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.791875
194	test-user-001	brand	Warner Bros	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.795574
195	test-user-001	brand	Hasbro	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.799118
196	test-user-001	brand	NFL	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.802683
197	test-user-001	brand	NBA	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.805884
198	test-user-001	brand	Premier League	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.809566
199	test-user-001	brand	UEFA	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.812347
200	test-user-001	brand	Bosch	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.815151
201	test-user-001	brand	Lego	\N	Toys - VeRO participant	t	2026-06-30 00:10:12.818217
202	test-user-001	brand	Ferrari	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.82196
203	test-user-001	brand	Mattel	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.824884
204	test-user-001	brand	DeWalt	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.827934
205	test-user-001	brand	Makita	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.831477
206	test-user-001	brand	3M	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.834767
207	test-user-001	brand	Snap-on	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.837768
208	test-user-001	brand	Vivienne Westwood	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.840767
209	test-user-001	brand	OtterBox	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.844363
210	test-user-001	brand	Le Creuset	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.849903
211	test-user-001	brand	UGG	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.85535
212	test-user-001	brand	Birkenstock	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.858118
213	test-user-001	brand	Converse	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.860922
214	test-user-001	brand	Mercedes-Benz	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.864503
215	test-user-001	brand	Audi	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.867726
216	test-user-001	brand	Disney	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.870571
217	test-user-001	brand	Crocs	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.873688
218	test-user-001	brand	Barbour	\N	Fashion - VeRO participant	t	2026-06-30 00:10:12.879106
219	test-user-001	brand	Paul Smith	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.882003
220	test-user-001	brand	Ted Baker	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.884809
221	test-user-001	brand	Superdry	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.888004
222	test-user-001	brand	Canada Goose	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.891514
223	test-user-001	brand	Harley-Davidson	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.894524
224	test-user-001	brand	Just for Men	\N	Health & grooming - VeRO participant	t	2026-06-30 00:10:12.898233
225	test-user-001	brand	Just For Men	\N	Health & grooming - VeRO participant	t	2026-06-30 00:10:12.902011
226	test-user-001	brand	Gillette	\N	Grooming - VeRO participant	t	2026-06-30 00:10:12.906201
227	test-user-001	brand	Braun	\N	Grooming/Electronics - VeRO participant	t	2026-06-30 00:10:12.909184
228	test-user-001	brand	Olay	\N	Beauty - VeRO participant	t	2026-06-30 00:10:12.912487
229	test-user-001	brand	Pantene	\N	Hair care - VeRO participant	t	2026-06-30 00:10:12.915691
230	test-user-001	brand	Head & Shoulders	\N	Hair care - VeRO participant	t	2026-06-30 00:10:12.919543
231	test-user-001	brand	Oral-B	\N	Dental care - VeRO participant	t	2026-06-30 00:10:12.922853
232	test-user-001	brand	Crest	\N	Dental care - VeRO participant	t	2026-06-30 00:10:12.926242
233	test-user-001	brand	Dove	\N	Personal care - VeRO participant	t	2026-06-30 00:10:12.929439
234	test-user-001	brand	Toyota	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.93322
235	test-user-001	brand	Dolce Gabbana	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.936058
236	test-user-001	brand	Nivea	\N	Skincare - VeRO participant	t	2026-06-30 00:10:12.939243
237	test-user-001	brand	GHD	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.942174
238	test-user-001	brand	ghd	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.94621
239	test-user-001	brand	Vaseline	\N	Skincare - VeRO participant	t	2026-06-30 00:10:12.956371
240	test-user-001	brand	CeraVe	\N	Skincare - VeRO participant	t	2026-06-30 00:10:12.960636
241	test-user-001	brand	The Ordinary	\N	Skincare - VeRO participant	t	2026-06-30 00:10:12.963597
242	test-user-001	brand	La Roche-Posay	\N	Skincare - VeRO participant	t	2026-06-30 00:10:12.967255
243	test-user-001	brand	Vichy	\N	Skincare - VeRO participant	t	2026-06-30 00:10:12.970513
244	test-user-001	brand	Bioderma	\N	Skincare - VeRO participant	t	2026-06-30 00:10:12.973902
245	test-user-001	brand	Garnier	\N	Beauty - VeRO participant	t	2026-06-30 00:10:12.976925
246	test-user-001	brand	Maybelline	\N	Cosmetics - VeRO participant	t	2026-06-30 00:10:12.981291
247	test-user-001	brand	Revlon	\N	Cosmetics - VeRO participant	t	2026-06-30 00:10:12.984261
248	test-user-001	brand	NYX	\N	Cosmetics - VeRO participant	t	2026-06-30 00:10:12.987259
249	test-user-001	brand	Rimmel	\N	Cosmetics - VeRO participant	t	2026-06-30 00:10:12.990201
250	test-user-001	brand	Max Factor	\N	Cosmetics - VeRO participant	t	2026-06-30 00:10:12.993794
251	test-user-001	brand	Clarins	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.996728
252	test-user-001	brand	Bobbi Brown	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:12.999818
253	test-user-001	brand	Morphe	\N	Cosmetics - VeRO participant	t	2026-06-30 00:10:13.005718
254	test-user-001	brand	Bare Minerals	\N	Cosmetics - VeRO participant	t	2026-06-30 00:10:13.009754
255	test-user-001	brand	bareMinerals	\N	Cosmetics - VeRO participant	t	2026-06-30 00:10:13.013523
256	test-user-001	brand	Shiseido	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:13.018691
257	test-user-001	brand	SK-II	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:13.02316
258	test-user-001	brand	Drunk Elephant	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:13.026934
259	test-user-001	brand	Tatcha	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:13.030098
260	test-user-001	brand	Giorgio Armani	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:13.036723
261	test-user-001	brand	Yves Saint Laurent	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:13.040158
262	test-user-001	brand	BaByliss	\N	Hair tools - VeRO participant	t	2026-06-30 00:10:13.043975
263	test-user-001	brand	Wahl	\N	Grooming - VeRO participant	t	2026-06-30 00:10:13.047069
264	test-user-001	brand	Schwarzkopf	\N	Hair care - VeRO participant	t	2026-06-30 00:10:13.050248
265	test-user-001	brand	Redken	\N	Hair care - VeRO participant	t	2026-06-30 00:10:13.053153
266	test-user-001	brand	Kérastase	\N	Hair care - VeRO participant	t	2026-06-30 00:10:13.058366
267	test-user-001	brand	Kerastase	\N	Hair care - VeRO participant	t	2026-06-30 00:10:13.061298
268	test-user-001	brand	Aussie	\N	Hair care - VeRO participant	t	2026-06-30 00:10:13.064006
269	test-user-001	brand	Herbal Essences	\N	Hair care - VeRO participant	t	2026-06-30 00:10:13.066729
270	test-user-001	brand	Colgate	\N	Dental care - VeRO participant	t	2026-06-30 00:10:13.071348
271	test-user-001	brand	Sensodyne	\N	Dental care - VeRO participant	t	2026-06-30 00:10:13.0748
272	test-user-001	brand	Marc Jacobs	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:13.077897
273	test-user-001	brand	YSL	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:13.080882
274	test-user-001	brand	Jean Paul Gaultier	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:13.084755
275	test-user-001	brand	Paco Rabanne	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:13.087901
276	test-user-001	brand	Thierry Mugler	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:13.091269
277	test-user-001	brand	Fenty Beauty	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:13.094561
278	test-user-001	brand	Davidoff	\N	Fragrance - VeRO participant	t	2026-06-30 00:10:13.100012
279	test-user-001	brand	Calvin Klein CK	\N	Fragrance - VeRO participant	t	2026-06-30 00:10:13.103029
280	test-user-001	brand	Acqua di Gio	\N	Fragrance - VeRO participant	t	2026-06-30 00:10:13.106181
281	test-user-001	brand	Sauvage	\N	Fragrance - VeRO participant	t	2026-06-30 00:10:13.108975
282	test-user-001	brand	Penhaligons	\N	Fragrance - VeRO participant	t	2026-06-30 00:10:13.112991
283	test-user-001	brand	Byredo	\N	Fragrance - VeRO participant	t	2026-06-30 00:10:13.115835
284	test-user-001	brand	Diptyque	\N	Fragrance - VeRO participant	t	2026-06-30 00:10:13.118516
285	test-user-001	brand	Intel	\N	Technology - VeRO participant	t	2026-06-30 00:10:13.121189
286	test-user-001	brand	AMD	\N	Technology - VeRO participant	t	2026-06-30 00:10:13.125109
287	test-user-001	brand	NVIDIA	\N	Technology - VeRO participant	t	2026-06-30 00:10:13.127816
288	test-user-001	brand	Google	\N	Technology - VeRO participant	t	2026-06-30 00:10:13.130666
289	test-user-001	brand	Dell	\N	Technology - VeRO participant	t	2026-06-30 00:10:13.133765
290	test-user-001	brand	HP	\N	Technology - VeRO participant	t	2026-06-30 00:10:13.137585
291	test-user-001	brand	Lenovo	\N	Technology - VeRO participant	t	2026-06-30 00:10:13.140792
292	test-user-001	brand	Acer	\N	Technology - VeRO participant	t	2026-06-30 00:10:13.144286
293	test-user-001	brand	TRESemmé	\N	Hair care - VeRO participant	t	2026-06-30 00:10:13.147264
294	test-user-001	brand	TRESemme	\N	Hair care - VeRO participant	t	2026-06-30 00:10:13.151122
295	test-user-001	brand	Neutrogena	\N	Skincare - VeRO participant	t	2026-06-30 00:10:13.154955
296	test-user-001	brand	Aveeno	\N	Skincare - VeRO participant	t	2026-06-30 00:10:13.158115
297	test-user-001	brand	Mulberry	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:13.161466
298	test-user-001	brand	MCM	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:13.165427
299	test-user-001	brand	LG	\N	Technology - VeRO participant	t	2026-06-30 00:10:13.168724
300	test-user-001	brand	Ferragamo	\N	Luxury goods - VeRO participant	t	2026-06-30 00:10:13.172475
301	test-user-001	brand	Celine	\N	Luxury goods - VeRO participant	t	2026-06-30 00:10:13.177013
302	test-user-001	brand	Loewe	\N	Luxury goods - VeRO participant	t	2026-06-30 00:10:13.180727
303	test-user-001	brand	Loro Piana	\N	Luxury goods - VeRO participant	t	2026-06-30 00:10:13.186271
304	test-user-001	brand	Brunello Cucinelli	\N	Luxury goods - VeRO participant	t	2026-06-30 00:10:13.189576
305	test-user-001	brand	Rimowa	\N	Luggage - VeRO participant	t	2026-06-30 00:10:13.193066
306	test-user-001	brand	Panasonic	\N	Technology - VeRO participant	t	2026-06-30 00:10:13.197287
307	test-user-001	brand	Toshiba	\N	Technology - VeRO participant	t	2026-06-30 00:10:13.200489
308	test-user-001	brand	Huawei	\N	Technology - VeRO participant	t	2026-06-30 00:10:13.203918
309	test-user-001	brand	OnePlus	\N	Technology - VeRO participant	t	2026-06-30 00:10:13.207377
310	test-user-001	brand	Xiaomi	\N	Technology - VeRO participant	t	2026-06-30 00:10:13.212331
311	test-user-001	brand	Marshall	\N	Audio - VeRO participant	t	2026-06-30 00:10:13.217676
312	test-user-001	brand	Sennheiser	\N	Audio - VeRO participant	t	2026-06-30 00:10:13.221959
313	test-user-001	brand	Logitech	\N	Technology - VeRO participant	t	2026-06-30 00:10:13.225212
314	test-user-001	brand	Razer	\N	Gaming peripherals - VeRO participant	t	2026-06-30 00:10:13.229275
315	test-user-001	brand	SteelSeries	\N	Gaming peripherals - VeRO participant	t	2026-06-30 00:10:13.233469
316	test-user-001	brand	Corsair	\N	Gaming peripherals - VeRO participant	t	2026-06-30 00:10:13.236896
317	test-user-001	brand	Nest	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:13.240698
318	test-user-001	brand	Bang & Olufsen	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:13.245918
319	test-user-001	brand	Amazon Echo	\N	Smart home - VeRO participant	t	2026-06-30 00:10:13.2493
320	test-user-001	brand	Alexa	\N	Smart home - VeRO participant	t	2026-06-30 00:10:13.252852
321	test-user-001	brand	Roku	\N	Streaming - VeRO participant	t	2026-06-30 00:10:13.256181
322	test-user-001	brand	Epson	\N	Printers - VeRO participant	t	2026-06-30 00:10:13.26381
323	test-user-001	brand	Brother	\N	Printers - VeRO participant	t	2026-06-30 00:10:13.266753
324	test-user-001	brand	SanDisk	\N	Storage - VeRO participant	t	2026-06-30 00:10:13.269923
325	test-user-001	brand	Western Digital	\N	Storage - VeRO participant	t	2026-06-30 00:10:13.273193
326	test-user-001	brand	Seagate	\N	Storage - VeRO participant	t	2026-06-30 00:10:13.27838
327	test-user-001	brand	Kingston	\N	Storage - VeRO participant	t	2026-06-30 00:10:13.281868
328	test-user-001	brand	Zara	\N	Fashion - VeRO participant	t	2026-06-30 00:10:13.285192
329	test-user-001	brand	H&M	\N	Fashion - VeRO participant	t	2026-06-30 00:10:13.288049
330	test-user-001	brand	ASOS	\N	Fashion - VeRO participant	t	2026-06-30 00:10:13.291802
331	test-user-001	brand	Levi's	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:13.300023
332	test-user-001	brand	Hollister	\N	Fashion - VeRO participant	t	2026-06-30 00:10:13.30469
333	test-user-001	brand	Gap	\N	Fashion - VeRO participant	t	2026-06-30 00:10:13.308029
334	test-user-001	brand	Levis	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:13.311853
335	test-user-001	brand	Osprey	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:13.314882
336	test-user-001	brand	Wrangler	\N	Fashion - VeRO participant	t	2026-06-30 00:10:13.318037
337	test-user-001	brand	True Religion	\N	Fashion - VeRO participant	t	2026-06-30 00:10:13.320994
338	test-user-001	brand	G-Star Raw	\N	Fashion - VeRO participant	t	2026-06-30 00:10:13.324811
339	test-user-001	brand	Diesel	\N	Fashion - VeRO participant	t	2026-06-30 00:10:13.327967
340	test-user-001	brand	Guess	\N	Fashion - VeRO participant	t	2026-06-30 00:10:13.331139
341	test-user-001	brand	Berghaus	\N	Outdoor fashion - VeRO participant	t	2026-06-30 00:10:13.333713
342	test-user-001	brand	Arc'teryx	\N	Outdoor fashion - VeRO participant	t	2026-06-30 00:10:13.336935
343	test-user-001	brand	Arcteryx	\N	Outdoor fashion - VeRO participant	t	2026-06-30 00:10:13.340812
344	test-user-001	brand	Napapijri	\N	Fashion - VeRO participant	t	2026-06-30 00:10:13.343805
345	test-user-001	brand	Timberland	\N	Footwear/Fashion - VeRO participant	t	2026-06-30 00:10:13.346853
346	test-user-001	brand	Skechers	\N	Footwear - VeRO participant	t	2026-06-30 00:10:13.351657
347	test-user-001	brand	ASICS	\N	Footwear/Sports - VeRO participant	t	2026-06-30 00:10:13.354786
348	test-user-001	brand	Jordan	\N	Footwear/Sports - VeRO participant	t	2026-06-30 00:10:13.358098
349	test-user-001	brand	Air Jordan	\N	Footwear/Sports - VeRO participant	t	2026-06-30 00:10:13.360755
350	test-user-001	brand	Clarks	\N	Footwear - VeRO participant	t	2026-06-30 00:10:13.364157
351	test-user-001	brand	ECCO	\N	Footwear - VeRO participant	t	2026-06-30 00:10:13.367646
352	test-user-001	brand	Samsonite	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:13.370494
353	test-user-001	brand	Tumi	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:13.376929
354	test-user-001	brand	Ring	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:13.38172
355	test-user-001	brand	Casio	\N	Watches - VeRO participant	t	2026-06-30 00:10:13.385065
356	test-user-001	brand	Seiko	\N	Watches - VeRO participant	t	2026-06-30 00:10:13.388421
357	test-user-001	brand	Citizen	\N	Watches - VeRO participant	t	2026-06-30 00:10:13.391769
358	test-user-001	brand	Tissot	\N	Watches - VeRO participant	t	2026-06-30 00:10:13.396582
359	test-user-001	brand	Furla	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:13.400147
360	test-user-001	brand	Longchamp	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:13.403418
361	test-user-001	brand	G-Shock	\N	Watches - VeRO participant	t	2026-06-30 00:10:13.406423
362	test-user-001	brand	Callaway	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:13.41017
363	test-user-001	brand	iRobot	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:13.413999
364	test-user-001	brand	Roomba	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:13.417463
365	test-user-001	brand	IWC	\N	Watches - VeRO participant	t	2026-06-30 00:10:13.421213
366	test-user-001	brand	Theragun	\N	Fitness - VeRO participant	t	2026-06-30 00:10:13.425385
367	test-user-001	brand	Bowflex	\N	Fitness - VeRO participant	t	2026-06-30 00:10:13.429211
368	test-user-001	brand	Titleist	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:13.432331
369	test-user-001	brand	Speedo	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:13.43569
370	test-user-001	brand	Shimano	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:13.441054
371	test-user-001	brand	Ping	\N	Golf - VeRO participant	t	2026-06-30 00:10:13.444524
372	test-user-001	brand	Specialized	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:13.447663
373	test-user-001	brand	Spalding	\N	Sports - VeRO participant	t	2026-06-30 00:10:13.452415
374	test-user-001	brand	Wilson	\N	Sports - VeRO participant	t	2026-06-30 00:10:13.455981
375	test-user-001	brand	Yonex	\N	Sports - VeRO participant	t	2026-06-30 00:10:13.458933
376	test-user-001	brand	HEAD	\N	Sports - VeRO participant	t	2026-06-30 00:10:13.462538
377	test-user-001	brand	Trek	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:13.466406
378	test-user-001	brand	Johnson & Johnson	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:13.470221
379	test-user-001	brand	Breville	\N	Kitchen - VeRO participant	t	2026-06-30 00:10:13.473849
380	test-user-001	brand	Kenwood	\N	Kitchen - VeRO participant	t	2026-06-30 00:10:13.476991
381	test-user-001	brand	Nutribullet	\N	Kitchen - VeRO participant	t	2026-06-30 00:10:13.480253
382	test-user-001	brand	NutriBullet	\N	Kitchen - VeRO participant	t	2026-06-30 00:10:13.484161
383	test-user-001	brand	Vitamix	\N	Kitchen - VeRO participant	t	2026-06-30 00:10:13.487276
384	test-user-001	brand	Shark	\N	Home appliances - VeRO participant	t	2026-06-30 00:10:13.490718
385	test-user-001	brand	Snap On	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:13.493883
386	test-user-001	brand	Red Bull	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:13.497417
387	test-user-001	brand	Ninja	\N	Kitchen - VeRO participant	t	2026-06-30 00:10:13.500323
388	test-user-001	brand	Instant Pot	\N	Kitchen - VeRO participant	t	2026-06-30 00:10:13.503287
389	test-user-001	brand	Nespresso	\N	Kitchen - VeRO participant	t	2026-06-30 00:10:13.506549
390	test-user-001	brand	De'Longhi	\N	Kitchen - VeRO participant	t	2026-06-30 00:10:13.510896
391	test-user-001	brand	Sage	\N	Kitchen - VeRO participant	t	2026-06-30 00:10:13.51439
392	test-user-001	brand	Smeg	\N	Kitchen - VeRO participant	t	2026-06-30 00:10:13.517207
393	test-user-001	brand	Dualit	\N	Kitchen - VeRO participant	t	2026-06-30 00:10:13.520391
394	test-user-001	brand	Russell Hobbs	\N	Kitchen - VeRO participant	t	2026-06-30 00:10:13.530123
395	test-user-001	brand	Tefal	\N	Kitchen - VeRO participant	t	2026-06-30 00:10:13.533005
396	test-user-001	brand	Morphy Richards	\N	Kitchen - VeRO participant	t	2026-06-30 00:10:13.535923
397	test-user-001	brand	Miele	\N	Home appliances - VeRO participant	t	2026-06-30 00:10:13.539264
398	test-user-001	brand	Karcher	\N	Home appliances - VeRO participant	t	2026-06-30 00:10:13.542573
399	test-user-001	brand	Kärcher	\N	Home appliances - VeRO participant	t	2026-06-30 00:10:13.546573
400	test-user-001	brand	Hoover	\N	Home appliances - VeRO participant	t	2026-06-30 00:10:13.549521
401	test-user-001	brand	Vax	\N	Home appliances - VeRO participant	t	2026-06-30 00:10:13.552434
402	test-user-001	brand	BISSELL	\N	Home appliances - VeRO participant	t	2026-06-30 00:10:13.555848
403	test-user-001	brand	Bosch Auto	\N	Automotive - VeRO participant	t	2026-06-30 00:10:13.558909
404	test-user-001	brand	Brembo	\N	Automotive - VeRO participant	t	2026-06-30 00:10:13.561706
405	test-user-001	brand	Denso	\N	Automotive - VeRO participant	t	2026-06-30 00:10:13.564996
406	test-user-001	brand	Thule	\N	Automotive accessories - VeRO participant	t	2026-06-30 00:10:13.568482
407	test-user-001	brand	Coca-Cola	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:13.571647
408	test-user-001	brand	Halfords	\N	Automotive - VeRO participant	t	2026-06-30 00:10:13.574391
409	test-user-001	brand	Bayer	\N	Pharmaceuticals - VeRO participant	t	2026-06-30 00:10:13.578685
410	test-user-001	brand	Pfizer	\N	Pharmaceuticals - VeRO participant	t	2026-06-30 00:10:13.582345
411	test-user-001	brand	GSK	\N	Pharmaceuticals - VeRO participant	t	2026-06-30 00:10:13.585178
412	test-user-001	brand	GlaxoSmithKline	\N	Pharmaceuticals - VeRO participant	t	2026-06-30 00:10:13.588538
413	test-user-001	brand	Durex	\N	Health - VeRO participant	t	2026-06-30 00:10:13.591401
414	test-user-001	brand	Cadbury	\N	Food - VeRO participant	t	2026-06-30 00:10:13.594399
415	test-user-001	brand	Nestlé	\N	Food - VeRO participant	t	2026-06-30 00:10:13.597255
416	test-user-001	brand	Nestle	\N	Food - VeRO participant	t	2026-06-30 00:10:13.599987
417	test-user-001	brand	Peloton	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:13.602996
418	test-user-001	brand	Pepsi	\N	Beverage - VeRO participant	t	2026-06-30 00:10:13.606424
419	test-user-001	brand	Jack Daniels	\N	Alcohol - VeRO participant	t	2026-06-30 00:10:13.6097
420	test-user-001	brand	Guinness	\N	Alcohol - VeRO participant	t	2026-06-30 00:10:13.612751
421	test-user-001	brand	Longines	\N	Watches - VeRO participant	t	2026-06-30 00:10:13.615904
422	test-user-001	brand	Tudor	\N	Watches - VeRO participant	t	2026-06-30 00:10:13.620035
423	test-user-001	brand	Daniel Wellington	\N	Watches - VeRO participant	t	2026-06-30 00:10:13.622756
424	test-user-001	brand	Fossil	\N	Watches - VeRO participant	t	2026-06-30 00:10:13.625737
425	test-user-001	brand	Versace	\N	Luxury goods - VeRO participant	t	2026-06-30 00:10:13.630661
426	test-user-001	brand	Alexander McQueen	\N	Luxury goods - VeRO participant	t	2026-06-30 00:10:13.635123
427	test-user-001	brand	Off-White	\N	Streetwear - VeRO participant	t	2026-06-30 00:10:13.638253
428	test-user-001	brand	Salvatore Ferragamo	\N	Luxury goods - VeRO participant	t	2026-06-30 00:10:13.641027
429	test-user-001	brand	Hublot	\N	Watches - VeRO participant	t	2026-06-30 00:10:13.643939
430	test-user-001	brand	Audemars Piguet	\N	Watches - VeRO participant	t	2026-06-30 00:10:13.647692
431	test-user-001	brand	David Yurman	\N	Jewellery - VeRO participant	t	2026-06-30 00:10:13.650775
432	test-user-001	brand	Chopard	\N	Jewellery/Watches - VeRO participant	t	2026-06-30 00:10:13.653871
433	test-user-001	brand	Van Cleef & Arpels	\N	Jewellery - VeRO participant	t	2026-06-30 00:10:13.656771
434	test-user-001	brand	Graff	\N	Jewellery - VeRO participant	t	2026-06-30 00:10:13.660591
435	test-user-001	brand	Chanel No. 5	\N	Fragrance - VeRO participant	t	2026-06-30 00:10:13.663498
436	test-user-001	brand	Gucci Eyewear	\N	Eyewear - VeRO participant	t	2026-06-30 00:10:13.670192
437	test-user-001	brand	Prada Eyewear	\N	Eyewear - VeRO participant	t	2026-06-30 00:10:13.673322
438	test-user-001	brand	Johnnie Walker	\N	Alcohol - VeRO participant	t	2026-06-30 00:10:13.676932
439	test-user-001	brand	Steam	\N	Gaming - VeRO participant	t	2026-06-30 00:10:13.680097
440	test-user-001	brand	Epic Games	\N	Gaming - VeRO participant	t	2026-06-30 00:10:13.6831
441	test-user-001	brand	Roblox	\N	Gaming - VeRO participant	t	2026-06-30 00:10:13.686873
442	test-user-001	brand	Links of London	\N	Jewellery - VeRO participant	t	2026-06-30 00:10:13.692218
443	test-user-001	brand	Thomas Sabo	\N	Jewellery - VeRO participant	t	2026-06-30 00:10:13.69824
444	test-user-001	brand	Persol	\N	Eyewear - VeRO participant	t	2026-06-30 00:10:13.701341
445	test-user-001	brand	Tom Ford Eyewear	\N	Eyewear - VeRO participant	t	2026-06-30 00:10:13.705042
446	test-user-001	brand	Maui Jim	\N	Eyewear - VeRO participant	t	2026-06-30 00:10:13.707907
447	test-user-001	brand	Hills	\N	Pet food - VeRO participant	t	2026-06-30 00:10:13.711541
448	test-user-001	brand	Montblanc Pen	\N	Luxury goods - VeRO participant	t	2026-06-30 00:10:13.714651
449	test-user-001	brand	Parker Pen	\N	Stationery - VeRO participant	t	2026-06-30 00:10:13.71805
450	test-user-001	brand	Cross Pen	\N	Stationery - VeRO participant	t	2026-06-30 00:10:13.720803
451	test-user-001	brand	PlayStation	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:13.724361
452	test-user-001	brand	Xbox	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:13.727206
453	test-user-001	brand	Royal Canin	\N	VeRO protected brand — actively enforced	t	2026-06-30 00:10:13.730656
\.


--
-- Data for Name: wallet; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.wallet (id, user_id, balance, currency, updated_at, referral_balance, points, bank_account_name, bank_account_number, bank_sort_code, bank_name) FROM stdin;
\.


--
-- Name: addon_purchases_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.addon_purchases_id_seq', 1, false);


--
-- Name: admin_settings_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.admin_settings_id_seq', 1, false);


--
-- Name: app_settings_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.app_settings_id_seq', 1, false);


--
-- Name: audit_logs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.audit_logs_id_seq', 24, true);


--
-- Name: catalog_refresh_log_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.catalog_refresh_log_id_seq', 1, true);


--
-- Name: content_filters_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.content_filters_id_seq', 1, false);


--
-- Name: conversations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.conversations_id_seq', 1, false);


--
-- Name: drop_and_sell_orders_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.drop_and_sell_orders_id_seq', 4, true);


--
-- Name: feature_flags_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.feature_flags_id_seq', 4, true);


--
-- Name: freelancer_profiles_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.freelancer_profiles_id_seq', 5, true);


--
-- Name: fulfillment_jobs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.fulfillment_jobs_id_seq', 1, false);


--
-- Name: global_vero_list_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.global_vero_list_id_seq', 453, true);


--
-- Name: import_jobs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.import_jobs_id_seq', 1, false);


--
-- Name: marketplace_listings_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.marketplace_listings_id_seq', 3, true);


--
-- Name: messages_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.messages_id_seq', 1, false);


--
-- Name: notifications_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.notifications_id_seq', 1, false);


--
-- Name: orders_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.orders_id_seq', 1, false);


--
-- Name: payment_cards_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.payment_cards_id_seq', 1, false);


--
-- Name: paypal_payout_accruals_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.paypal_payout_accruals_id_seq', 1, false);


--
-- Name: pricing_rules_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.pricing_rules_id_seq', 3, true);


--
-- Name: product_variations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.product_variations_id_seq', 1, false);


--
-- Name: products_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.products_id_seq', 6, true);


--
-- Name: publish_queue_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.publish_queue_id_seq', 3, true);


--
-- Name: referrals_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.referrals_id_seq', 4, true);


--
-- Name: restock_logs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.restock_logs_id_seq', 1, false);


--
-- Name: restricted_products_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.restricted_products_id_seq', 1, false);


--
-- Name: return_requests_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.return_requests_id_seq', 1, false);


--
-- Name: shipping_profiles_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.shipping_profiles_id_seq', 1, false);


--
-- Name: sku_mappings_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.sku_mappings_id_seq', 1, false);


--
-- Name: stores_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.stores_id_seq', 8, true);


--
-- Name: subscriptions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.subscriptions_id_seq', 2, true);


--
-- Name: suggestions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.suggestions_id_seq', 1, false);


--
-- Name: supplier_replacement_log_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.supplier_replacement_log_id_seq', 1, false);


--
-- Name: transactions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.transactions_id_seq', 6, true);


--
-- Name: trending_products_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.trending_products_id_seq', 7857, true);


--
-- Name: vendors_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.vendors_id_seq', 533, true);


--
-- Name: vero_audit_log_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.vero_audit_log_id_seq', 1, false);


--
-- Name: vero_brand_aliases_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.vero_brand_aliases_id_seq', 32, true);


--
-- Name: vero_list_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.vero_list_id_seq', 453, true);


--
-- Name: wallet_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.wallet_id_seq', 12, true);


--
-- Name: addon_catalog addon_catalog_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.addon_catalog
    ADD CONSTRAINT addon_catalog_pkey PRIMARY KEY (id);


--
-- Name: addon_purchases addon_purchases_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.addon_purchases
    ADD CONSTRAINT addon_purchases_pkey PRIMARY KEY (id);


--
-- Name: admin_settings admin_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admin_settings
    ADD CONSTRAINT admin_settings_pkey PRIMARY KEY (id);


--
-- Name: app_settings app_settings_key_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.app_settings
    ADD CONSTRAINT app_settings_key_key UNIQUE (key);


--
-- Name: app_settings app_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.app_settings
    ADD CONSTRAINT app_settings_pkey PRIMARY KEY (id);


--
-- Name: app_state app_state_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.app_state
    ADD CONSTRAINT app_state_pkey PRIMARY KEY (key);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: broadcast_campaign_log broadcast_campaign_log_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.broadcast_campaign_log
    ADD CONSTRAINT broadcast_campaign_log_pkey PRIMARY KEY (broadcast_date);


--
-- Name: catalog_refresh_log catalog_refresh_log_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.catalog_refresh_log
    ADD CONSTRAINT catalog_refresh_log_pkey PRIMARY KEY (id);


--
-- Name: content_filters content_filters_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.content_filters
    ADD CONSTRAINT content_filters_pkey PRIMARY KEY (id);


--
-- Name: conversations conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_pkey PRIMARY KEY (id);


--
-- Name: drop_and_sell_orders drop_and_sell_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.drop_and_sell_orders
    ADD CONSTRAINT drop_and_sell_orders_pkey PRIMARY KEY (id);


--
-- Name: feature_flags feature_flags_feature_key_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.feature_flags
    ADD CONSTRAINT feature_flags_feature_key_key UNIQUE (feature_key);


--
-- Name: feature_flags feature_flags_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.feature_flags
    ADD CONSTRAINT feature_flags_pkey PRIMARY KEY (id);


--
-- Name: freelancer_profiles freelancer_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.freelancer_profiles
    ADD CONSTRAINT freelancer_profiles_pkey PRIMARY KEY (id);


--
-- Name: fulfillment_jobs fulfillment_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fulfillment_jobs
    ADD CONSTRAINT fulfillment_jobs_pkey PRIMARY KEY (id);


--
-- Name: global_vero_list global_vero_list_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.global_vero_list
    ADD CONSTRAINT global_vero_list_pkey PRIMARY KEY (id);


--
-- Name: import_jobs import_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.import_jobs
    ADD CONSTRAINT import_jobs_pkey PRIMARY KEY (id);


--
-- Name: marketplace_listings marketplace_listings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketplace_listings
    ADD CONSTRAINT marketplace_listings_pkey PRIMARY KEY (id);


--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);


--
-- Name: payment_cards payment_cards_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payment_cards
    ADD CONSTRAINT payment_cards_pkey PRIMARY KEY (id);


--
-- Name: paypal_payout_accruals paypal_payout_accruals_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.paypal_payout_accruals
    ADD CONSTRAINT paypal_payout_accruals_pkey PRIMARY KEY (id);


--
-- Name: pricing_rules pricing_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pricing_rules
    ADD CONSTRAINT pricing_rules_pkey PRIMARY KEY (id);


--
-- Name: product_variations product_variations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_variations
    ADD CONSTRAINT product_variations_pkey PRIMARY KEY (id);


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- Name: publish_queue publish_queue_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.publish_queue
    ADD CONSTRAINT publish_queue_pkey PRIMARY KEY (id);


--
-- Name: referrals referrals_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.referrals
    ADD CONSTRAINT referrals_pkey PRIMARY KEY (id);


--
-- Name: restock_logs restock_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.restock_logs
    ADD CONSTRAINT restock_logs_pkey PRIMARY KEY (id);


--
-- Name: restricted_products restricted_products_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.restricted_products
    ADD CONSTRAINT restricted_products_pkey PRIMARY KEY (id);


--
-- Name: return_requests return_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.return_requests
    ADD CONSTRAINT return_requests_pkey PRIMARY KEY (id);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (sid);


--
-- Name: shipping_profiles shipping_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shipping_profiles
    ADD CONSTRAINT shipping_profiles_pkey PRIMARY KEY (id);


--
-- Name: sku_mappings sku_mappings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sku_mappings
    ADD CONSTRAINT sku_mappings_pkey PRIMARY KEY (id);


--
-- Name: stores stores_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stores
    ADD CONSTRAINT stores_pkey PRIMARY KEY (id);


--
-- Name: subscriptions subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_pkey PRIMARY KEY (id);


--
-- Name: suggestions suggestions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.suggestions
    ADD CONSTRAINT suggestions_pkey PRIMARY KEY (id);


--
-- Name: supplier_replacement_log supplier_replacement_log_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.supplier_replacement_log
    ADD CONSTRAINT supplier_replacement_log_pkey PRIMARY KEY (id);


--
-- Name: transactions transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_pkey PRIMARY KEY (id);


--
-- Name: trending_products trending_products_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.trending_products
    ADD CONSTRAINT trending_products_pkey PRIMARY KEY (id);


--
-- Name: users users_api_key_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_api_key_key UNIQUE (api_key);


--
-- Name: users users_email_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_unique UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_referral_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_referral_code_key UNIQUE (referral_code);


--
-- Name: users users_referral_code_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_referral_code_unique UNIQUE (referral_code);


--
-- Name: users users_unique_url_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_unique_url_key UNIQUE (unique_url);


--
-- Name: users users_unique_url_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_unique_url_unique UNIQUE (unique_url);


--
-- Name: vendors vendors_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vendors
    ADD CONSTRAINT vendors_pkey PRIMARY KEY (id);


--
-- Name: vero_audit_log vero_audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vero_audit_log
    ADD CONSTRAINT vero_audit_log_pkey PRIMARY KEY (id);


--
-- Name: vero_brand_aliases vero_brand_aliases_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vero_brand_aliases
    ADD CONSTRAINT vero_brand_aliases_pkey PRIMARY KEY (id);


--
-- Name: vero_list vero_list_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vero_list
    ADD CONSTRAINT vero_list_pkey PRIMARY KEY (id);


--
-- Name: wallet wallet_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wallet
    ADD CONSTRAINT wallet_pkey PRIMARY KEY (id);


--
-- Name: wallet wallet_user_id_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wallet
    ADD CONSTRAINT wallet_user_id_unique UNIQUE (user_id);


--
-- Name: IDX_session_expire; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_session_expire" ON public.sessions USING btree (expire);


--
-- Name: conversations_user_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX conversations_user_id_idx ON public.conversations USING btree (user_id);


--
-- Name: paypal_payout_accruals_user_month_uniq; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX paypal_payout_accruals_user_month_uniq ON public.paypal_payout_accruals USING btree (user_id, month_year, recipient_handle);


--
-- Name: products_listed_by_freelancer_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX products_listed_by_freelancer_idx ON public.products USING btree (listed_by_freelancer_id) WHERE (listed_by_freelancer_id IS NOT NULL);


--
-- Name: users_api_key_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX users_api_key_idx ON public.users USING btree (api_key) WHERE (api_key IS NOT NULL);


--
-- Name: users_referral_code_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX users_referral_code_idx ON public.users USING btree (referral_code) WHERE (referral_code IS NOT NULL);


--
-- Name: addon_purchases addon_purchases_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.addon_purchases
    ADD CONSTRAINT addon_purchases_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: audit_logs audit_logs_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id);


--
-- Name: audit_logs audit_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: content_filters content_filters_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.content_filters
    ADD CONSTRAINT content_filters_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: drop_and_sell_orders drop_and_sell_orders_freelancer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.drop_and_sell_orders
    ADD CONSTRAINT drop_and_sell_orders_freelancer_id_fkey FOREIGN KEY (freelancer_id) REFERENCES public.freelancer_profiles(id);


--
-- Name: drop_and_sell_orders drop_and_sell_orders_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.drop_and_sell_orders
    ADD CONSTRAINT drop_and_sell_orders_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: fulfillment_jobs fulfillment_jobs_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fulfillment_jobs
    ADD CONSTRAINT fulfillment_jobs_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id);


--
-- Name: fulfillment_jobs fulfillment_jobs_sku_mapping_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fulfillment_jobs
    ADD CONSTRAINT fulfillment_jobs_sku_mapping_id_fkey FOREIGN KEY (sku_mapping_id) REFERENCES public.sku_mappings(id);


--
-- Name: fulfillment_jobs fulfillment_jobs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fulfillment_jobs
    ADD CONSTRAINT fulfillment_jobs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: fulfillment_jobs fulfillment_jobs_vendor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fulfillment_jobs
    ADD CONSTRAINT fulfillment_jobs_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES public.vendors(id);


--
-- Name: import_jobs import_jobs_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.import_jobs
    ADD CONSTRAINT import_jobs_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: import_jobs import_jobs_vendor_id_vendors_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.import_jobs
    ADD CONSTRAINT import_jobs_vendor_id_vendors_id_fk FOREIGN KEY (vendor_id) REFERENCES public.vendors(id);


--
-- Name: marketplace_listings marketplace_listings_product_id_products_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketplace_listings
    ADD CONSTRAINT marketplace_listings_product_id_products_id_fk FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: marketplace_listings marketplace_listings_store_id_stores_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketplace_listings
    ADD CONSTRAINT marketplace_listings_store_id_stores_id_fk FOREIGN KEY (store_id) REFERENCES public.stores(id);


--
-- Name: messages messages_conversation_id_conversations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_conversation_id_conversations_id_fk FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id);


--
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: orders orders_store_id_stores_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_store_id_stores_id_fk FOREIGN KEY (store_id) REFERENCES public.stores(id);


--
-- Name: orders orders_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: payment_cards payment_cards_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payment_cards
    ADD CONSTRAINT payment_cards_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: paypal_payout_accruals paypal_payout_accruals_settled_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.paypal_payout_accruals
    ADD CONSTRAINT paypal_payout_accruals_settled_by_user_id_fkey FOREIGN KEY (settled_by_user_id) REFERENCES public.users(id);


--
-- Name: paypal_payout_accruals paypal_payout_accruals_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.paypal_payout_accruals
    ADD CONSTRAINT paypal_payout_accruals_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: pricing_rules pricing_rules_apply_to_vendor_vendors_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pricing_rules
    ADD CONSTRAINT pricing_rules_apply_to_vendor_vendors_id_fk FOREIGN KEY (apply_to_vendor) REFERENCES public.vendors(id);


--
-- Name: pricing_rules pricing_rules_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pricing_rules
    ADD CONSTRAINT pricing_rules_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: product_variations product_variations_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_variations
    ADD CONSTRAINT product_variations_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: products products_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: products products_vendor_id_vendors_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_vendor_id_vendors_id_fk FOREIGN KEY (vendor_id) REFERENCES public.vendors(id);


--
-- Name: publish_queue publish_queue_pricing_rule_id_pricing_rules_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.publish_queue
    ADD CONSTRAINT publish_queue_pricing_rule_id_pricing_rules_id_fk FOREIGN KEY (pricing_rule_id) REFERENCES public.pricing_rules(id);


--
-- Name: publish_queue publish_queue_product_id_products_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.publish_queue
    ADD CONSTRAINT publish_queue_product_id_products_id_fk FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: publish_queue publish_queue_store_id_stores_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.publish_queue
    ADD CONSTRAINT publish_queue_store_id_stores_id_fk FOREIGN KEY (store_id) REFERENCES public.stores(id);


--
-- Name: publish_queue publish_queue_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.publish_queue
    ADD CONSTRAINT publish_queue_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: referrals referrals_referred_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.referrals
    ADD CONSTRAINT referrals_referred_user_id_users_id_fk FOREIGN KEY (referred_user_id) REFERENCES public.users(id);


--
-- Name: referrals referrals_referrer_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.referrals
    ADD CONSTRAINT referrals_referrer_id_users_id_fk FOREIGN KEY (referrer_id) REFERENCES public.users(id);


--
-- Name: restock_logs restock_logs_marketplace_listing_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.restock_logs
    ADD CONSTRAINT restock_logs_marketplace_listing_id_fkey FOREIGN KEY (marketplace_listing_id) REFERENCES public.marketplace_listings(id);


--
-- Name: restock_logs restock_logs_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.restock_logs
    ADD CONSTRAINT restock_logs_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: restock_logs restock_logs_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.restock_logs
    ADD CONSTRAINT restock_logs_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id);


--
-- Name: restricted_products restricted_products_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.restricted_products
    ADD CONSTRAINT restricted_products_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: return_requests return_requests_fulfillment_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.return_requests
    ADD CONSTRAINT return_requests_fulfillment_job_id_fkey FOREIGN KEY (fulfillment_job_id) REFERENCES public.fulfillment_jobs(id);


--
-- Name: return_requests return_requests_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.return_requests
    ADD CONSTRAINT return_requests_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id);


--
-- Name: return_requests return_requests_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.return_requests
    ADD CONSTRAINT return_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: shipping_profiles shipping_profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shipping_profiles
    ADD CONSTRAINT shipping_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: sku_mappings sku_mappings_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sku_mappings
    ADD CONSTRAINT sku_mappings_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: sku_mappings sku_mappings_vendor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sku_mappings
    ADD CONSTRAINT sku_mappings_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES public.vendors(id);


--
-- Name: stores stores_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stores
    ADD CONSTRAINT stores_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: subscriptions subscriptions_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: suggestions suggestions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.suggestions
    ADD CONSTRAINT suggestions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: supplier_replacement_log supplier_replacement_log_new_vendor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.supplier_replacement_log
    ADD CONSTRAINT supplier_replacement_log_new_vendor_id_fkey FOREIGN KEY (new_vendor_id) REFERENCES public.vendors(id);


--
-- Name: supplier_replacement_log supplier_replacement_log_old_vendor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.supplier_replacement_log
    ADD CONSTRAINT supplier_replacement_log_old_vendor_id_fkey FOREIGN KEY (old_vendor_id) REFERENCES public.vendors(id);


--
-- Name: supplier_replacement_log supplier_replacement_log_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.supplier_replacement_log
    ADD CONSTRAINT supplier_replacement_log_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: transactions transactions_wallet_id_wallet_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_wallet_id_wallet_id_fk FOREIGN KEY (wallet_id) REFERENCES public.wallet(id);


--
-- Name: vendors vendors_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vendors
    ADD CONSTRAINT vendors_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: vero_list vero_list_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vero_list
    ADD CONSTRAINT vero_list_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: wallet wallet_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wallet
    ADD CONSTRAINT wallet_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- PostgreSQL database dump complete
--

\unrestrict mrsZLasWCyttzivxGYuvOtGWdffOvNa2lQ1t1ekNbcsYAM4LJQzV8DdTybenrBi

