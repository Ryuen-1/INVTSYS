import { createClient } from 'npm:@supabase/supabase-js@2'

type UserRole = 'admin' | 'manager' | 'staff'

type AdminUserPayload = {
  id?: string
  email?: string
  password?: string
  full_name?: string | null
  role?: UserRole
  branch_id?: string | null
}

type RequestBody = {
  action?: 'list' | 'create' | 'update' | 'delete'
  user?: AdminUserPayload
}

const corsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Origin': '*',
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const secretKey = getSecretKey()

    if (!supabaseUrl || !secretKey) {
      return json({ error: 'Missing Supabase function secrets.' }, 500)
    }

    const authHeader = request.headers.get('Authorization')

    if (!authHeader) {
      return json({ error: 'Missing authorization header.' }, 401)
    }

    const supabaseAdmin = createClient(supabaseUrl, secretKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    const token = authHeader.replace('Bearer ', '')
    const {
      data: { user: caller },
      error: callerError,
    } = await supabaseAdmin.auth.getUser(token)

    if (callerError || !caller) {
      return json({ error: 'Invalid user session.' }, 401)
    }

    const { data: callerProfile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', caller.id)
      .single()

    if (profileError || callerProfile?.role !== 'admin') {
      return json({ error: 'Admin access required.' }, 403)
    }

    const body = (await request.json().catch(() => ({}))) as RequestBody
    const action = body.action ?? 'list'

    if (action === 'list') {
      return json({ users: await listUsers(supabaseAdmin) })
    }

    if (action === 'create') {
      const user = requireUserPayload(body.user)
      const email = requiredString(user.email, 'Email is required.')
      const password = requiredString(user.password, 'Password is required.')
      const role = normalizeRole(user.role)

      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: user.full_name ?? null,
        },
      })

      if (error || !data.user) {
        return json({ error: error?.message ?? 'Unable to create user.' }, 400)
      }

      await upsertProfile(supabaseAdmin, {
        id: data.user.id,
        full_name: cleanNullableString(user.full_name),
        role,
        branch_id: cleanNullableString(user.branch_id),
      })

      return json({ user: data.user })
    }

    if (action === 'update') {
      const user = requireUserPayload(body.user)
      const id = requiredString(user.id, 'User id is required.')
      const role = normalizeRole(user.role)
      const attributes: {
        email?: string
        password?: string
        user_metadata?: { full_name: string | null }
      } = {
        user_metadata: {
          full_name: cleanNullableString(user.full_name),
        },
      }

      if (user.email?.trim()) {
        attributes.email = user.email.trim()
      }

      if (user.password?.trim()) {
        attributes.password = user.password
      }

      const { data, error } = await supabaseAdmin.auth.admin.updateUserById(id, attributes)

      if (error || !data.user) {
        return json({ error: error?.message ?? 'Unable to update user.' }, 400)
      }

      await upsertProfile(supabaseAdmin, {
        id,
        full_name: cleanNullableString(user.full_name),
        role,
        branch_id: cleanNullableString(user.branch_id),
      })

      return json({ user: data.user })
    }

    if (action === 'delete') {
      const user = requireUserPayload(body.user)
      const id = requiredString(user.id, 'User id is required.')

      if (id === caller.id) {
        return json({ error: 'You cannot delete your own account here.' }, 400)
      }

      const { error } = await supabaseAdmin.auth.admin.deleteUser(id)

      if (error) {
        return json({ error: error.message }, 400)
      }

      return json({ ok: true })
    }

    return json({ error: 'Unsupported action.' }, 400)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error.'
    return json({ error: message }, 400)
  }
})

async function listUsers(supabaseAdmin: ReturnType<typeof createClient>) {
  const users = []
  let page = 1
  const perPage = 1000

  while (true) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage,
    })

    if (error) {
      throw error
    }

    users.push(...data.users)

    if (data.users.length < perPage) {
      break
    }

    page += 1
  }

  const { data: profiles, error: profilesError } = await supabaseAdmin
    .from('profiles')
    .select('id, full_name, role, branch_id')

  if (profilesError) {
    throw profilesError
  }

  const profileById = new Map(profiles.map((profile) => [profile.id, profile]))

  return users.map((user) => {
    const profile = profileById.get(user.id)

    return {
      id: user.id,
      email: user.email ?? '',
      created_at: user.created_at,
      last_sign_in_at: user.last_sign_in_at ?? null,
      email_confirmed_at: user.email_confirmed_at ?? null,
      full_name:
        profile?.full_name ??
        (typeof user.user_metadata?.full_name === 'string'
          ? user.user_metadata.full_name
          : null),
      role: normalizeRole(profile?.role),
      branch_id: profile?.branch_id ?? null,
    }
  })
}

async function upsertProfile(
  supabaseAdmin: ReturnType<typeof createClient>,
  profile: {
    id: string
    full_name: string | null
    role: UserRole
    branch_id: string | null
  },
) {
  const { error } = await supabaseAdmin.from('profiles').upsert(profile, {
    onConflict: 'id',
  })

  if (error) {
    throw error
  }
}

function getSecretKey() {
  const modernKeys = Deno.env.get('SUPABASE_SECRET_KEYS')

  if (modernKeys) {
    const parsed = JSON.parse(modernKeys) as Record<string, string>
    return parsed.default ?? Object.values(parsed)[0]
  }

  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
    status,
  })
}

function requireUserPayload(user: AdminUserPayload | undefined) {
  if (!user) {
    throw new Error('User payload is required.')
  }

  return user
}

function requiredString(value: string | undefined, message: string) {
  const nextValue = value?.trim()

  if (!nextValue) {
    throw new Error(message)
  }

  return nextValue
}

function cleanNullableString(value: string | null | undefined) {
  const nextValue = value?.trim()
  return nextValue ? nextValue : null
}

function normalizeRole(value: unknown): UserRole {
  return value === 'admin' || value === 'manager' || value === 'staff'
    ? value
    : 'staff'
}
