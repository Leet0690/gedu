import React from 'react';
import { CalendarClock, Wrench } from 'lucide-react';

const ScheduleGeneration = () => {
  return (
    <div className="max-w-container section-padding">
      <div className="page-header">
        <h1 className="page-title">
          <CalendarClock className="page-title-icon" size={28} strokeWidth={2.5} />
          Génération des Emplois du Temps
        </h1>
        <p className="page-subtitle">
          Outil automatisé pour la création et la répartition des emplois du temps
        </p>
      </div>

      <div className="glass-card form-card mt-8 flex flex-col items-center justify-center py-24">
        <div className="rounded-full bg-primary/10 p-6 mb-6 relative">
          <Wrench size={48} className="text-primary" />
          <div className="absolute top-0 right-0 w-3 h-3 bg-secondary rounded-full animate-ping"></div>
        </div>
        <h2 className="text-2xl font-bold text-slate-800 mb-3 text-center">En cours de construction</h2>
        <p className="text-slate-500 text-center max-w-md">
          Notre module intelligent de génération automatique des emplois du temps est actuellement en cours de développement. Cette fonctionnalité sera bientôt disponible !
        </p>
      </div>
    </div>
  );
};

export default ScheduleGeneration;
