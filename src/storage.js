const STORAGE_KEY = "leasereel-prototype-v3";

export function createRepository(config = {}) {
  const url = config.url || config.supabaseUrl || "";
  const anonKey = config.anonKey || config.supabaseAnonKey || "";

  if (url && anonKey) {
    return new SupabaseRepository(url, anonKey);
  }

  return new LocalRepository();
}

class LocalRepository {
  constructor() {
    this.kind = "local";
  }

  async initialize(seedData) {
    const existing = this.read();
    if (!existing || !existing.properties?.length) {
      this.write(seedData);
    }
  }

  async getState() {
    return this.read();
  }

  async getProperties() {
    return this.read().properties;
  }

  async getPosts() {
    return this.sortNewest(this.read().posts);
  }

  async getLeads() {
    return this.sortNewest(this.read().leads);
  }

  async savePost(post) {
    const state = this.read();
    state.posts = [post, ...state.posts.filter((existing) => existing.id !== post.id)];
    this.write(state);
    return post;
  }

  async saveLead(lead) {
    const state = this.read();
    state.leads = [lead, ...state.leads.filter((existing) => existing.id !== lead.id)];
    this.write(state);
    return lead;
  }

  async updateLeadStage(id, stage) {
    const state = this.read();
    const at = new Date().toISOString();
    state.leads = state.leads.map((lead) => {
      if (lead.id !== id) return lead;
      const history = Array.isArray(lead.stage_history) ? lead.stage_history : [];
      return { ...lead, stage, stage_history: [...history, { stage, at }] };
    });
    this.write(state);
    return state.leads.find((lead) => lead.id === id);
  }

  read() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  write(state) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  sortNewest(rows) {
    return [...rows].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }
}

class SupabaseRepository {
  constructor(url, anonKey) {
    this.kind = "supabase";
    this.url = url.replace(/\/$/, "");
    this.anonKey = anonKey;
  }

  async initialize(seedData) {
    const properties = await this.getProperties();
    if (properties.length === 0) {
      await this.insertMany("properties", seedData.properties);
      await this.insertMany("posts", seedData.posts);
      await this.insertMany("leads", seedData.leads);
    }
  }

  async getState() {
    const [properties, posts, leads] = await Promise.all([
      this.getProperties(),
      this.getPosts(),
      this.getLeads()
    ]);
    return { properties, posts, leads };
  }

  async getProperties() {
    return this.request("properties?select=*&order=name.asc");
  }

  async getPosts() {
    return this.request("posts?select=*&order=created_at.desc");
  }

  async getLeads() {
    return this.request("leads?select=*&order=created_at.desc");
  }

  async savePost(post) {
    const result = await this.request("posts", {
      method: "POST",
      body: JSON.stringify(post)
    });
    return Array.isArray(result) ? result[0] : result;
  }

  async saveLead(lead) {
    const result = await this.request("leads", {
      method: "POST",
      body: JSON.stringify(lead)
    });
    return Array.isArray(result) ? result[0] : result;
  }

  async updateLeadStage(id, stage) {
    // Read-then-write: append to stage_history so the transition (not just
    // the current value) is preserved as part of the owned lead record.
    const existing = await this.request(`leads?id=eq.${encodeURIComponent(id)}&select=stage_history`);
    const row = Array.isArray(existing) ? existing[0] : existing;
    const history = Array.isArray(row?.stage_history) ? row.stage_history : [];
    const at = new Date().toISOString();
    const result = await this.request(`leads?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({ stage, stage_history: [...history, { stage, at }] })
    });
    return Array.isArray(result) ? result[0] : result;
  }

  async insertMany(table, rows) {
    if (!rows.length) return [];
    return this.request(table, {
      method: "POST",
      body: JSON.stringify(rows)
    });
  }

  async request(path, options = {}) {
    const response = await fetch(`${this.url}/rest/v1/${path}`, {
      ...options,
      headers: {
        apikey: this.anonKey,
        authorization: `Bearer ${this.anonKey}`,
        "content-type": "application/json",
        prefer: "return=representation",
        ...(options.headers || {})
      }
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(`Supabase request failed: ${message}`);
    }

    if (response.status === 204) return [];
    return response.json();
  }
}
