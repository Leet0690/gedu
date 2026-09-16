import { BookOpen, CalendarDays, Layers } from 'lucide-react';
import './DashboardWelcome.css';

// A small, local vector illustration: no image download or database read.
const LearningCommunity = () => (
  <svg viewBox="0 0 248 144" fill="none" aria-hidden="true" focusable="false">
    <path d="M31 111C10 82 41 29 94 35C113 3 184 6 201 46C243 54 247 113 211 126C161 145 64 142 31 111Z" fill="#eee8f2" />
    <path d="M29 107C22 90 21 82 24 69M24 85C14 82 12 75 13 71C22 70 26 77 24 85ZM25 98C35 95 39 88 37 84C28 85 24 91 25 98Z" stroke="#8d9e8d" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M224 105C229 91 230 83 227 75M228 88C238 83 239 77 237 72C229 74 226 81 228 88Z" stroke="#8d9e8d" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M47 115V100C47 84 59 76 73 76C88 76 99 86 99 100V115" fill="#a9bbb0" />
    <path d="M56 64C50 43 65 34 77 38C93 40 95 52 90 67L56 64Z" fill="#51434d" />
    <rect x="59" y="46" width="28" height="34" rx="14" fill="#dbac8e" />
    <path d="M58 53C67 54 72 49 75 43C76 50 82 53 88 53" fill="#51434d" />
    <path d="M69 67Q73 71 77 67" stroke="#80524b" strokeWidth="1.6" strokeLinecap="round" />
    <path d="M151 115V102C151 86 162 77 177 77C192 77 203 86 203 102V115" fill="#d4a174" />
    <path d="M158 80V54C158 39 166 34 178 34C193 34 198 44 198 58V82" fill="#5b425a" />
    <rect x="164" y="45" width="28" height="36" rx="14" fill="#f0c9ac" />
    <path d="M163 54C171 54 178 48 180 42C184 51 188 53 193 54" fill="#5b425a" />
    <path d="M174 67Q178 71 182 67" stroke="#a67161" strokeWidth="1.6" strokeLinecap="round" />
    <path d="M89 119V96C89 77 104 66 124 66C144 66 159 77 159 96V119" fill="#806095" />
    <path d="M103 50C99 32 107 20 123 20C140 20 149 31 145 50" fill="#433647" />
    <rect x="108" y="29" width="32" height="42" rx="16" fill="#bd8565" />
    <path d="M105 42C116 39 121 35 124 27C127 34 134 39 143 40" fill="#433647" />
    <path d="M119 55Q124 59 129 55" stroke="#704839" strokeWidth="1.8" strokeLinecap="round" />
    <path d="M105 85L124 97L144 85V118L124 128L105 118V85Z" fill="#fffaf0" />
    <path d="M124 98V124M111 96L118 100M111 104L118 108M131 100L138 96M131 108L138 104" stroke="#d1b99c" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M108 114L98 109M141 114L151 109" stroke="#bd8565" strokeWidth="8" strokeLinecap="round" />
    <path d="M52 25L54 19L56 25L62 27L56 29L54 35L52 29L46 27L52 25Z" fill="#d8b16e" />
    <circle cx="209" cy="33" r="3" fill="#c6a6d0" />
  </svg>
);

export default function DashboardWelcome({ displayName, academicYear, semester }) {
  const name = String(displayName || '').trim();
  const now = new Date();
  const greeting = now.getHours() >= 18 ? 'Bonsoir' : 'Bonjour';
  const dateLabel = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }).format(now);

  return (
    <header className="dashboard-welcome">
      <div className="dashboard-welcome-copy">
        <span className="dashboard-welcome-eyebrow">Tableau de bord · Votre espace IPFP</span>
        <h1>{greeting}{name ? <>, <span>{name}</span></> : ''}<span className="dashboard-welcome-dot">.</span></h1>
        <p>Retrouvez vos équipes, vos stagiaires et les priorités du jour.</p>
        <div className="dashboard-welcome-details">
          <span><CalendarDays size={14} aria-hidden="true" /> {dateLabel}</span>
          {academicYear && <span><BookOpen size={14} aria-hidden="true" /> {academicYear}</span>}
          {semester && <span><Layers size={14} aria-hidden="true" /> {semester}</span>}
        </div>
      </div>
      <div className="dashboard-welcome-community">
        <LearningCommunity />
        <span>Chaque parcours compte.</span>
      </div>
    </header>
  );
}
