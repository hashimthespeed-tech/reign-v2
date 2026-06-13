import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { Spinner } from './components/ui'
import Entry from './pages/Entry'
import SystemCheck from './pages/SystemCheck'
import TeacherOnboarding from './pages/onboarding/TeacherOnboarding'
import StudentOnboarding from './pages/onboarding/StudentOnboarding'
import TeacherDashboard from './pages/TeacherDashboard'
import StudentDashboard from './pages/StudentDashboard'
import ComingSoon from './pages/ComingSoon'
import Portfolio from './pages/Portfolio'
import Leaderboard from './pages/Leaderboard'

function FullSpinner() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Spinner size={30} />
    </div>
  )
}

// Require a logged-in TEACHER. Otherwise route them sensibly.
function TeacherRoute({ children }) {
  const { user, profile, loading } = useAuth()
  if (loading) return <FullSpinner />
  if (!user) return <Navigate to="/onboarding/teacher" replace />
  if (profile && profile.investor_type !== 'teacher') return <Navigate to="/dashboard" replace />
  return children
}

// Require a logged-in STUDENT with a completed profile + class.
function StudentRoute({ children }) {
  const { user, profile, loading } = useAuth()
  if (loading) return <FullSpinner />
  if (!user) return <Navigate to="/onboarding" replace />
  if (profile?.investor_type === 'teacher') return <Navigate to="/teacher" replace />
  // No profile or not yet in a class → resume onboarding.
  if (!profile || !profile.class_id) return <Navigate to="/onboarding" replace />
  return children
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<Entry />} />
        <Route path="/system" element={<SystemCheck />} />
        <Route path="/onboarding" element={<StudentOnboarding />} />
        <Route path="/onboarding/teacher" element={<TeacherOnboarding />} />
        <Route path="/teacher" element={<TeacherRoute><TeacherDashboard /></TeacherRoute>} />
        <Route path="/dashboard" element={<StudentRoute><StudentDashboard /></StudentRoute>} />
        <Route path="/portfolio" element={<StudentRoute><Portfolio /></StudentRoute>} />
        <Route path="/leaderboard" element={<StudentRoute><Leaderboard /></StudentRoute>} />
        <Route path="/learning" element={<StudentRoute><ComingSoon title="Learning" blurb="Your arsenal of investing concepts, unlocked as you level up from Watcher to Investor. Arrives in the learning build." /></StudentRoute>} />
        <Route path="/settings" element={<StudentRoute><ComingSoon title="Settings" blurb="Profile, display, and the real-money transition when you're ready. Arrives in the settings build." /></StudentRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  )
}
