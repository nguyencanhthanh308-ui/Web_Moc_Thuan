create table if not exists products (
  id int primary key,
  code text unique not null,
  data jsonb not null,
  hidden boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists settings (
  key text primary key,
  value jsonb not null
);

create table if not exists users (
  id serial primary key,
  email text unique not null,
  password_hash text not null,
  role text not null check (role in ('admin','customer')),
  name text,
  phone text,
  address text,
  created_at timestamptz default now()
);

create table if not exists sessions (
  token_hash text primary key,
  user_id int not null references users(id) on delete cascade,
  expires_at timestamptz not null
);

create table if not exists password_resets (
  token_hash text primary key,
  user_id int references users(id) on delete cascade,
  expires_at timestamptz not null,
  used boolean default false
);

create table if not exists orders (
  id serial primary key,
  code text unique not null,
  status text not null,
  customer jsonb not null,
  payment text not null check (payment in ('chuyen-khoan','khi-nhan')),
  user_id int references users(id),
  lines jsonb not null,
  total bigint not null,
  note text,
  internal_note text,
  request_id text unique,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists order_events (
  id serial primary key,
  order_id int references orders(id) on delete cascade,
  kind text not null check (kind in ('tao','trang-thai','sua')),
  actor_id int references users(id),
  before jsonb,
  after jsonb,
  at timestamptz default now()
);
