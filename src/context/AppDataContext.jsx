import React, { createContext, useContext, useState, useEffect } from 'react';
import { initialMachines } from '../data/machines';
import { initialWorkOrders } from '../data/workOrders';
import { initialAlerts } from '../data/alerts';

const AppDataContext = createContext();

export function AppDataProvider({ children }) {
  const [machines, setMachines] = useState(() => {
    const saved = localStorage.getItem('predictx_machines_v2');
    return saved ? JSON.parse(saved) : initialMachines;
  });

  const [workOrders, setWorkOrders] = useState(() => {
    const saved = localStorage.getItem('predictx_workorders_v2');
    return saved ? JSON.parse(saved) : initialWorkOrders;
  });

  const [alerts, setAlerts] = useState(() => {
    const saved = localStorage.getItem('predictx_alerts_v2');
    return saved ? JSON.parse(saved) : initialAlerts;
  });

  const [priorityWeights, setPriorityWeights] = useState({
    risk: 0.50,
    criticality: 0.25,
    impact: 0.15,
    urgency: 0.10
  });

  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    localStorage.setItem('predictx_machines_v2', JSON.stringify(machines));
  }, [machines]);

  useEffect(() => {
    localStorage.setItem('predictx_workorders_v2', JSON.stringify(workOrders));
  }, [workOrders]);

  useEffect(() => {
    localStorage.setItem('predictx_alerts_v2', JSON.stringify(alerts));
  }, [alerts]);

  const addToast = (message, type = 'info') => {
    const id = Date.now() + Math.random().toString();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  const removeToast = (id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const addWorkOrder = (newOrder) => {
    const id = `WO-${Math.floor(1000 + Math.random() * 9000)}`;
    const fullOrder = {
      ...newOrder,
      id,
      createdAt: new Date().toISOString().split('T')[0],
      priorityScore: newOrder.priorityScore || 75
    };
    setWorkOrders(prev => [fullOrder, ...prev]);
    addToast(`Work Order ${id} created for ${fullOrder.machineName}`, 'success');
    return fullOrder;
  };

  const updateWorkOrderStatus = (orderId, newStatus) => {
    setWorkOrders(prev => prev.map(wo => {
      if (wo.id === orderId) {
        return { ...wo, status: newStatus };
      }
      return wo;
    }));
    addToast(`Work Order ${orderId} status updated to ${newStatus}`, 'info');
  };

  const resetAllDemoData = () => {
    setMachines(initialMachines);
    setWorkOrders(initialWorkOrders);
    setAlerts(initialAlerts);
    setPriorityWeights({ risk: 0.50, criticality: 0.25, impact: 0.15, urgency: 0.10 });
    localStorage.removeItem('predictx_machines');
    localStorage.removeItem('predictx_workorders');
    localStorage.removeItem('predictx_alerts');
    localStorage.removeItem('predictx_machines_v2');
    localStorage.removeItem('predictx_workorders_v2');
    localStorage.removeItem('predictx_alerts_v2');
    addToast('Demo dataset refreshed to default NASA C-MAPSS state', 'info');
  };

  const markAlertAsRead = (alertId) => {
    setAlerts(prev => prev.map(a => a.id === alertId ? { ...a, read: true } : a));
  };

  return (
    <AppDataContext.Provider value={{
      machines,
      setMachines,
      workOrders,
      addWorkOrder,
      updateWorkOrderStatus,
      alerts,
      markAlertAsRead,
      priorityWeights,
      setPriorityWeights,
      resetAllDemoData,
      toasts,
      addToast,
      removeToast
    }}>
      {children}
    </AppDataContext.Provider>
  );
}

export function useAppData() {
  const context = useContext(AppDataContext);
  if (!context) {
    throw new Error('useAppData must be used within an AppDataProvider');
  }
  return context;
}
