import React from 'react';

export const Spinner = ({ size = 'md' }) => {
  const s = { sm: 'w-4 h-4 border-2', md: 'w-8 h-8 border-2', lg: 'w-12 h-12 border-3' }[size];
  return <div className={`${s} border-slate-200 border-t-blue-600 rounded-full animate-spin`} />;
};

export const PageLoader = () => (
  <div className="flex items-center justify-center py-24">
    <Spinner size="lg" />
  </div>
);

export const EmptyState = ({ icon: Icon, title, description, action }) => (
  <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
    <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400">
      <Icon size={32} />
    </div>
    <div>
      <p className="font-semibold text-slate-700 text-lg">{title}</p>
      <p className="text-slate-400 text-sm mt-1">{description}</p>
    </div>
    {action}
  </div>
);
