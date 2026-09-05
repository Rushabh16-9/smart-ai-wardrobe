import { createClient } from '@/lib/supabase/server';
import { Metadata } from 'next';
import { HistoryList } from '@/components/history-list';

export const metadata: Metadata = {
  title: 'Wear History',
  description: 'Review your past outfits and AI styling sessions.',
};

export default async function HistoryPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: history } = await supabase
    .from('wear_history')
    .select('*')
    .eq('user_id', user!.id)
    .order('worn_at', { ascending: false })
    .limit(20);

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-8">
        <p className="text-xs uppercase tracking-widest text-primary/70 font-medium mb-1">Your Style Journey</p>
        <h1 className="text-3xl lg:text-4xl font-bold text-foreground">Wear History</h1>
        <p className="text-muted-foreground text-sm mt-2">
          All your past outfit recommendations and styling sessions.
        </p>
      </div>

      {!history || history.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-20 h-20 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mb-6 text-3xl">
            ◷
          </div>
          <h2 className="text-xl font-semibold text-foreground mb-3">No history yet</h2>
          <p className="text-muted-foreground text-sm max-w-sm">
            Visit the AI Stylist, get an outfit recommendation, and save it to build your style history.
          </p>
        </div>
      ) : (
        <HistoryList history={history} />
      )}
    </div>
  );
}
