import { Presentation, Calendar } from "lucide-react";

export default function ClasesLoading() {
  return (
    <div className="max-w-6xl mx-auto pb-8 space-y-6 animate-pulse">
      {/* Header Skeleton */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-lilac-100 flex items-center justify-center text-lilac-400">
          <Presentation size={24} />
        </div>
        <div className="space-y-2">
          <div className="h-6 w-72 bg-slate-200 rounded-lg" />
          <div className="h-3 w-96 bg-slate-100 rounded-md" />
        </div>
      </div>

      {/* Course Selection Cards Skeleton */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="card p-4 bg-white border border-slate-100 rounded-2xl space-y-3 shadow-2xs">
            <div className="flex items-start gap-3.5">
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-slate-100 shrink-0" />
              <div className="space-y-2 flex-1 min-w-0">
                <div className="h-4 w-16 bg-slate-100 rounded-md" />
                <div className="h-5 w-full bg-slate-200 rounded-md" />
                <div className="h-3 w-3/4 bg-slate-100 rounded-md" />
              </div>
            </div>
            <div className="pt-2.5 border-t border-slate-100 flex justify-between items-center">
              <div className="h-3 w-28 bg-slate-100 rounded-md" />
              <div className="h-4 w-20 bg-slate-100 rounded-md" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
