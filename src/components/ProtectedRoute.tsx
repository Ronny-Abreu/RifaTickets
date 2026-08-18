import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';

interface Props {
  children: React.ReactNode;
  requiredRole: string;
  redirectTo?: string;
}

export const ProtectedRoute: React.FC<Props> = ({ children, requiredRole, redirectTo = '/' }) => {
  const [status, setStatus] = useState<'loading' | 'authorized' | 'unauthorized'>('loading');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setStatus('unauthorized');
        return;
      }

      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        const role = userDoc.data()?.role;
        setStatus(role === requiredRole ? 'authorized' : 'unauthorized');
      } catch {
        setStatus('unauthorized');
      }
    });

    return unsubscribe;
  }, [requiredRole]);

  if (status === 'loading') return null;
  if (status === 'unauthorized') return <Navigate to={redirectTo} replace />;

  return <>{children}</>;
};
