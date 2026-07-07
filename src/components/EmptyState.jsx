import { memo } from 'react';
import { SearchX, Inbox, Ghost, Filter, BookOpen, Calendar, Users, MousePointer2 } from 'lucide-react';
import { motion } from 'framer-motion';

const icons = {
  search: SearchX,
  empty: Inbox,
  ghost: Ghost,
  filter: Filter,
  book: BookOpen,
  calendar: Calendar,
  users: Users,
  'mouse-pointer': MousePointer2
};

const EmptyState = memo(function EmptyState({
  title = "Aucune donnée trouvée", 
  message = "Nous n'avons trouvé aucun résultat correspondant à votre recherche.",
  icon = "empty",
  action
}) {
  const Icon = icons[icon] || icons.empty;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        justifyContent: 'center', 
        padding: 'var(--space-16) var(--space-6)',
        textAlign: 'center'
      }}
    >
      <div style={{ 
        width: '80px', 
        height: '80px', 
        borderRadius: '50%', 
        background: 'var(--primary-ultra-light)', 
        color: 'var(--primary)',
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        marginBottom: 'var(--space-6)',
        boxShadow: '0 0 40px rgba(176, 104, 185, 0.1)'
      }}>
        <Icon size={40} strokeWidth={1.5} />
      </div>

      <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: '800', color: 'var(--text-primary)', marginBottom: 'var(--space-2)' }}>
        {title}
      </h3>
      
      <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', maxWidth: '320px', lineHeight: '1.6', marginBottom: action ? 'var(--space-8)' : 0 }}>
        {message}
      </p>

      {action && (
        <button onClick={action.onClick} className="btn-modern primary">
          {action.label}
        </button>
      )}
    </motion.div>
  );
});

export default EmptyState;
