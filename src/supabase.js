import { createClient } from '@supabase/supabase-js';

// Get environment variables
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

// Check if we have valid Supabase credentials
const hasValidSupabaseConfig = supabaseUrl && 
  supabaseKey && 
  supabaseUrl !== 'your_supabase_url_here' && 
  supabaseKey !== 'your_supabase_anon_key_here' &&
  supabaseUrl.includes('supabase.co');

// Create Supabase client if credentials are available
let supabase = null;
if (hasValidSupabaseConfig) {
  try {
    supabase = createClient(supabaseUrl, supabaseKey);
    console.log('✅ Supabase client initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize Supabase client:', error);
  }
}

// Enhanced sync service with Supabase support
class SimpleSyncService {
  constructor() {
    this.channels = new Map();
    this.listeners = new Map();
    this.subscriptions = new Map();
    this.useSupabase = hasValidSupabaseConfig && supabase;
    
    if (this.useSupabase) {
      console.log('🚀 Using Supabase for real-time sync');
    } else {
      console.log('📱 Using localStorage + BroadcastChannel for demo sync');
    }
  }

  // Database optimization methods
  async updateSheet(sheetId, sheetData) {
    if (this.useSupabase) {
      try {
        // Check if sheet exists
        const { data: existing, error: selectError } = await supabase
          .from('live_sheets')
          .select('id')
          .eq('id', sheetId)
          .single();

        if (selectError && selectError.code !== 'PGRST116') {
          console.error('Error checking sheet:', selectError);
          return false;
        }

        const dataToStore = {
          id: sheetId,
          data: sheetData,
          updated_at: new Date().toISOString()
        };

        if (existing) {
          // Update existing sheet
          const { error: updateError } = await supabase
            .from('live_sheets')
            .update({
              data: sheetData,
              updated_at: new Date().toISOString()
            })
            .eq('id', sheetId);

          if (updateError) {
            console.error('Error updating sheet:', updateError);
            return false;
          }
          console.log(`✅ Updated sheet in database: ${sheetId}`);
        } else {
          // Create new sheet
          const { error: insertError } = await supabase
            .from('live_sheets')
            .insert(dataToStore);

          if (insertError) {
            console.error('Error creating sheet:', insertError);
            return false;
          }
          console.log(`✅ Created new sheet in database: ${sheetId}`);
        }
        return true;
      } catch (error) {
        console.error('Database operation error:', error);
        return false;
      }
    }
    // Fallback to localStorage for demo
    localStorage.setItem(`sync_${sheetId}`, JSON.stringify(sheetData));
    return true;
  }

  async deleteSheet(sheetId) {
    if (this.useSupabase) {
      try {
        const { error } = await supabase
          .from('live_sheets')
          .delete()
          .eq('id', sheetId);

        if (error) {
          console.error('Error deleting sheet:', error);
          return false;
        }
        console.log(`✅ Deleted sheet from database: ${sheetId}`);
        return true;
      } catch (error) {
        console.error('Database delete error:', error);
        return false;
      }
    }
    // Fallback to localStorage cleanup
    localStorage.removeItem(`sync_${sheetId}`);
    localStorage.removeItem(`live_${sheetId}`);
    return true;
  }

  async renameSheet(sheetId, newName) {
    if (this.useSupabase) {
      try {
        // Get current data
        const { data: current, error: selectError } = await supabase
          .from('live_sheets')
          .select('data')
          .eq('id', sheetId)
          .single();

        if (selectError) {
          console.error('Error fetching sheet for rename:', selectError);
          return false;
        }

        // Update with new name
        const updatedData = {
          ...current.data,
          name: newName
        };

        const { error: updateError } = await supabase
          .from('live_sheets')
          .update({
            data: updatedData,
            updated_at: new Date().toISOString()
          })
          .eq('id', sheetId);

        if (updateError) {
          console.error('Error renaming sheet:', updateError);
          return false;
        }
        console.log(`✅ Renamed sheet in database: ${sheetId} -> ${newName}`);
        return true;
      } catch (error) {
        console.error('Database rename error:', error);
        return false;
      }
    }
    // Fallback to localStorage
    const data = localStorage.getItem(`sync_${sheetId}`);
    if (data) {
      try {
        const parsed = JSON.parse(data);
        parsed.name = newName;
        localStorage.setItem(`sync_${sheetId}`, JSON.stringify(parsed));
        return true;
      } catch (e) {
        console.error('LocalStorage rename error:', e);
        return false;
      }
    }
    return true;
  }

  // Real-time subscription with Supabase or fallback to polling
  subscribe(channelId, callback) {
    if (this.useSupabase) {
      return this.subscribeWithSupabase(channelId, callback);
    } else {
      return this.subscribeWithLocalStorage(channelId, callback);
    }
  }

  // Supabase real-time subscription
  subscribeWithSupabase(channelId, callback) {
    try {
      // Subscribe to database changes
      const subscription = supabase
        .channel(`live_sheet_${channelId}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'live_sheets',
          filter: `id=eq.${channelId}`
        }, (payload) => {
          if (payload.new && payload.new.data) {
            callback(payload.new.data);
          }
        })
        .subscribe();

      this.subscriptions.set(channelId, subscription);

      // Also load initial data
      this.loadInitialData(channelId, callback);

      return () => {
        if (this.subscriptions.has(channelId)) {
          const sub = this.subscriptions.get(channelId);
          supabase.removeChannel(sub);
          this.subscriptions.delete(channelId);
        }
      };
    } catch (error) {
      console.error('Supabase subscription error:', error);
      // Fallback to localStorage method
      return this.subscribeWithLocalStorage(channelId, callback);
    }
  }

  // Load initial data from Supabase
  async loadInitialData(channelId, callback) {
    try {
      const { data, error } = await supabase
        .from('live_sheets')
        .select('data')
        .eq('id', channelId)
        .single();

      if (!error && data && data.data) {
        callback(data.data);
      }
    } catch (error) {
      console.error('Failed to load initial data:', error);
    }
  }

  // localStorage polling fallback
  subscribeWithLocalStorage(channelId, callback) {
    if (!this.listeners.has(channelId)) {
      this.listeners.set(channelId, new Set());
    }
    this.listeners.get(channelId).add(callback);

    // Start polling for changes from localStorage
    const pollInterval = setInterval(() => {
      const data = localStorage.getItem(`sync_${channelId}`);
      if (data) {
        try {
          const parsed = JSON.parse(data);
          callback(parsed);
        } catch (e) {
          console.error('Sync parse error:', e);
        }
      }
    }, 1000);

    return () => {
      clearInterval(pollInterval);
      if (this.listeners.has(channelId)) {
        this.listeners.get(channelId).delete(callback);
      }
    };
  }

  // Publish data with Supabase or localStorage
  async publish(channelId, data) {
    const enrichedData = {
      ...data,
      timestamp: Date.now(),
      id: Math.random().toString(36).substr(2, 9)
    };

    if (this.useSupabase) {
      return this.publishWithSupabase(channelId, enrichedData);
    } else {
      return this.publishWithLocalStorage(channelId, enrichedData);
    }
  }

  // Publish to Supabase database
  async publishWithSupabase(channelId, data) {
    try {
      const { error } = await supabase
        .from('live_sheets')
        .upsert({
          id: channelId,
          data: data,
          updated_at: new Date().toISOString()
        });

      if (error) {
        console.error('Supabase publish error:', error);
        // Fallback to localStorage
        this.publishWithLocalStorage(channelId, data);
      } else {
        console.log(`✅ Published to Supabase: ${channelId}`);
      }
    } catch (error) {
      console.error('Supabase publish error:', error);
      // Fallback to localStorage
      this.publishWithLocalStorage(channelId, data);
    }
  }

  // Publish to localStorage (fallback)
  publishWithLocalStorage(channelId, data) {
    // Store locally
    localStorage.setItem(`sync_${channelId}`, JSON.stringify(data));

    // Notify all listeners
    if (this.listeners.has(channelId)) {
      this.listeners.get(channelId).forEach(callback => {
        try {
          callback(data);
        } catch (e) {
          console.error('Callback error:', e);
        }
      });
    }

    // Use BroadcastChannel for cross-tab sync
    this.simulateBackendSync(channelId, data);
  }

  // Simulate backend synchronization
  async simulateBackendSync(channelId, data) {
    try {
      // In a real app, this would be an API call to your backend
      console.log(`[SYNC] Channel ${channelId}:`, data);
      
      // For demo: use browser's BroadcastChannel API for cross-tab sync
      if (typeof BroadcastChannel !== 'undefined') {
        const channel = new BroadcastChannel(`bill-splitter-${channelId}`);
        channel.postMessage(data);
      }
    } catch (e) {
      console.error('Backend sync error:', e);
    }
  }

  // Setup cross-tab listening
  setupCrossTabSync(channelId, callback) {
    if (typeof BroadcastChannel !== 'undefined') {
      const channel = new BroadcastChannel(`bill-splitter-${channelId}`);
      channel.onmessage = (event) => {
        callback(event.data);
      };
      return () => channel.close();
    }
    return () => {};
  }
}

// Create singleton instance
export const syncService = new SimpleSyncService();

// Export Supabase client for direct use if needed
export { supabase };

// Setup status for debugging
export const getSetupStatus = () => ({
  hasSupabaseConfig: hasValidSupabaseConfig,
  usingSupabase: syncService.useSupabase,
  environment: process.env.REACT_APP_ENV || 'development',
  supabaseUrl: supabaseUrl ? supabaseUrl.substring(0, 20) + '...' : 'Not configured'
});

// Production setup guide
export const showSetupGuide = () => {
  if (!hasValidSupabaseConfig) {
    console.log(`
🚀 PRODUCTION SETUP GUIDE

1. Create a Supabase account: https://supabase.com
2. Create a new project
3. In your project dashboard, go to Settings > API
4. Copy your Project URL and Public Anon Key
5. Create/update .env file in your project root:

REACT_APP_SUPABASE_URL=https://your-project-ref.supabase.co
REACT_APP_SUPABASE_ANON_KEY=your_public_anon_key_here
REACT_APP_ENV=production

6. Create the live_sheets table in Supabase:
   - Go to Database > Tables > Create Table
   - Table name: live_sheets
   - Columns:
     * id (text, primary key)
     * data (jsonb)
     * updated_at (timestamp with timezone, default: now())

7. Enable Row Level Security (RLS):
   - Go to Authentication > Policies
   - Add policies for SELECT, INSERT, UPDATE operations

8. Restart your development server: npm start

Currently using: ${syncService.useSupabase ? 'Supabase (Production)' : 'localStorage (Demo)'}
    `);
  } else {
    console.log('✅ Supabase is properly configured and ready for production!');
  }
};
