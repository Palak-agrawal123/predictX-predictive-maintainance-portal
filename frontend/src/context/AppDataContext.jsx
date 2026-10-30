import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { initialMachines } from '../data/machines';
import { initialWorkOrders } from '../data/workOrders';
import { initialAlerts } from '../data/alerts';
import { api } from '../services/api';

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
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          // Strictly filter out legacy dummy records (ALT-1, ALT-2, MC-8210, etc.)
          return parsed.filter(a => a && !String(a.id || '').startsWith('ALT-') && a.machineId !== 'MC-8210' && a.machineId !== 'MC-5099' && a.machineId !== 'MC-7801' && a.machineId !== 'MC-6122');
        }
      } catch (e) {}
    }
    return [];
  });

  const [dashboardSummary, setDashboardSummary] = useState(null);
  const [pendingReviewsCount, setPendingReviewsCount] = useState(0);
  const [backendStatus, setBackendStatus] = useState({
    online: false,
    database: false,
    mlService: false,
    checked: false
  });
  const [isLoading, setIsLoading] = useState(false);

  const [priorityWeights, setPriorityWeights] = useState({
    risk: 0.50,
    criticality: 0.25,
    impact: 0.15,
    urgency: 0.10
  });

  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'info') => {
    const id = Date.now() + Math.random().toString();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4500);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // Fetch live data from Backend API and ML Service
  const refreshData = useCallback(async (showToast = false) => {
    setIsLoading(true);
    try {
      // 1. Check health
      const health = await api.checkHealth();
      setBackendStatus({
        online: health.online,
        database: health.database,
        mlService: health.mlService,
        checked: true,
        details: health.details
      });

      if (health.online) {
        // 2. Parallel fetch machines, work orders, dashboard summary, review metrics, and real notifications
        const [liveMachines, liveOrders, liveSummary, reviewRes, liveAlerts] = await Promise.all([
          api.getMachines(),
          api.getWorkOrders(),
          api.getDashboardSummary(),
          api.getAllReviews({ limit: 1 }).catch(() => null),
          api.getAlerts().catch(() => null)
        ]);

        if (Array.isArray(liveMachines) && liveMachines.length > 0) {
          setMachines(liveMachines);
          localStorage.setItem('predictx_machines_v2', JSON.stringify(liveMachines));
        }

        if (Array.isArray(liveOrders) && liveOrders.length > 0) {
          setWorkOrders(liveOrders);
          localStorage.setItem('predictx_workorders_v2', JSON.stringify(liveOrders));
        }

        if (Array.isArray(liveAlerts)) {
          setAlerts(liveAlerts);
          localStorage.setItem('predictx_alerts_v2', JSON.stringify(liveAlerts));
        }

        if (liveSummary) {
          setDashboardSummary(liveSummary);
          if (liveSummary.humanReviews?.pendingCount !== undefined) {
            setPendingReviewsCount(liveSummary.humanReviews.pendingCount);
          }
        }

        if (reviewRes?.metrics?.pendingCount !== undefined) {
          setPendingReviewsCount(reviewRes.metrics.pendingCount);
        }

        if (showToast) {
          addToast('Dashboard synchronized with live MongoDB & ML Microservice', 'success');
        }
      } else {
        if (showToast) {
          addToast('Backend offline - using local cached data', 'warning');
        }
      }
    } catch (err) {
      console.warn('[AppDataContext] Sync error:', err.message);
      if (showToast) {
        addToast(`Sync warning: ${err.message}`, 'warning');
      }
    } finally {
      setIsLoading(false);
    }
  }, [addToast]);

  // Initial load on mount + periodic background poll every 20 seconds
  useEffect(() => {
    refreshData(false);
    const interval = setInterval(() => {
      refreshData(false);
    }, 20000);
    return () => clearInterval(interval);
  }, [refreshData]);

  // Real-Time Server-Sent Events (SSE) Notification Stream
  useEffect(() => {
    let eventSource = null;
    try {
      const sseUrl = 'http://localhost:5000/api/notifications/stream';
      eventSource = new EventSource(sseUrl);

      eventSource.addEventListener('notification:new', (e) => {
        try {
          const newNotif = JSON.parse(e.data);
          const mapped = {
            id: newNotif.notificationId || newNotif._id,
            notificationId: newNotif.notificationId,
            machineId: newNotif.machineId || 'SYSTEM',
            machineName: newNotif.metadata?.machineName || newNotif.machineId || 'Industrial Asset',
            severity: newNotif.severity === 'CRITICAL' ? 'Critical' : newNotif.severity === 'WARNING' ? 'Warning' : newNotif.severity === 'SUCCESS' ? 'Success' : 'Info',
            message: newNotif.message || newNotif.title,
            title: newNotif.title,
            category: newNotif.category,
            eventType: newNotif.eventType,
            actionUrl: newNotif.actionUrl,
            timestamp: 'just now',
            read: false,
            createdAt: newNotif.createdAt || new Date().toISOString()
          };
          setAlerts(prev => [mapped, ...prev.filter(a => a.id !== mapped.id && a.notificationId !== mapped.id)]);
          
          if (newNotif.severity === 'CRITICAL') {
            addToast(`[CRITICAL] ${newNotif.title}`, 'error');
          } else if (newNotif.severity === 'WARNING') {
            addToast(`[ALERT] ${newNotif.title}`, 'warning');
          } else if (newNotif.severity === 'SUCCESS') {
            addToast(`[SUCCESS] ${newNotif.title}`, 'success');
          }
        } catch (err) {
          console.warn('[SSE Parse Error]', err);
        }
      });

      eventSource.addEventListener('notification:read', (e) => {
        try {
          const { notificationId } = JSON.parse(e.data);
          setAlerts(prev => prev.map(a => (a.id === notificationId || a.notificationId === notificationId) ? { ...a, read: true } : a));
        } catch (err) {}
      });

      eventSource.addEventListener('notification:read_all', () => {
        setAlerts(prev => prev.map(a => ({ ...a, read: true })));
      });

      eventSource.onerror = () => {
        // Native EventSource automatically handles reconnection
      };
    } catch (err) {
      console.warn('[SSE Init Error]', err);
    }

    return () => {
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [addToast]);

  // Save changes locally as cache
  useEffect(() => {
    localStorage.setItem('predictx_machines_v2', JSON.stringify(machines));
  }, [machines]);

  useEffect(() => {
    localStorage.setItem('predictx_workorders_v2', JSON.stringify(workOrders));
  }, [workOrders]);

  useEffect(() => {
    localStorage.setItem('predictx_alerts_v2', JSON.stringify(alerts));
  }, [alerts]);

  // Add work order (persists to backend MongoDB)
  const addWorkOrder = async (newOrder) => {
    addToast(`Saving work order for ${newOrder.machineName || newOrder.machineId}...`, 'info');
    const created = await api.createWorkOrder(newOrder);
    setWorkOrders(prev => [created, ...prev]);
    addToast(`Work Order ${created.id || created.workOrderId} created and stored in MongoDB`, 'success');
    // Refresh to get latest state from backend
    setTimeout(() => refreshData(false), 500);
    return created;
  };

  // Update work order status (persists to backend MongoDB)
  const updateWorkOrderStatus = async (orderId, newStatus) => {
    // Optimistic update
    setWorkOrders(prev => prev.map(wo => {
      if (wo.id === orderId || wo.workOrderId === orderId) {
        return { ...wo, status: newStatus };
      }
      return wo;
    }));

    addToast(`Saving work order status as "${newStatus}" in MongoDB...`, 'info');
    const updated = await api.updateWorkOrderStatus(orderId, newStatus);
    if (updated) {
      addToast(`Work order ${orderId} saved as "${newStatus}"`, 'success');
      setWorkOrders(prev => prev.map(wo => (wo.id === orderId || wo.workOrderId === orderId ? updated : wo)));
    }

    // Refresh summary so KPI metrics update
    setTimeout(async () => {
      const summary = await api.getDashboardSummary();
      if (summary) setDashboardSummary(summary);
    }, 300);
  };

  // Update machine operational status (persists to backend MongoDB)
  const updateMachineStatus = async (machineId, newStatus) => {
    // Optimistic update
    setMachines(prev => prev.map(m => {
      if (m.id === machineId || m.machineId === machineId) {
        return { ...m, status: newStatus };
      }
      return m;
    }));

    addToast(`Updating machine ${machineId} status to "${newStatus}"...`, 'info');
    const updated = await api.updateMachineStatus(machineId, newStatus);
    if (updated) {
      addToast(`Machine ${machineId} is now "${newStatus}" in MongoDB`, 'success');
      setMachines(prev => prev.map(m => (m.id === machineId || m.machineId === machineId ? { ...m, status: newStatus } : m)));
    }

    // Refresh summary so Fleet KPIs update
    setTimeout(async () => {
      const summary = await api.getDashboardSummary();
      if (summary) setDashboardSummary(summary);
    }, 300);
  };

  // Run live prediction: calls backend -> ML model -> saves to MongoDB -> updates dashboard
  const runMachinePrediction = async (machineId, sensorOverrides = null) => {
    addToast(`Submitting sensor readings for ${machineId} to XGBoost ML Service...`, 'info');
    const predResult = await api.triggerPrediction(machineId, sensorOverrides);

    if (predResult) {
      // Immediate optimistic update of the targeted machine
      setMachines(prev => prev.map(m => {
        if (m.id === machineId || m.machineId === machineId) {
          return {
            ...m,
            healthScore: predResult.healthScore ?? m.healthScore,
            riskScore: predResult.riskScore ?? m.riskScore,
            riskLevel: predResult.riskBand ?? m.riskLevel,
            predictedRul: predResult.predictedRul ?? m.predictedRul,
            predictedFault: predResult.suspectedFailureMode && predResult.suspectedFailureMode !== 'None' ? predResult.suspectedFailureMode : m.predictedFault,
            recommendedAction: predResult.recommendedAction || m.recommendedAction,
            dataSource: 'FastAPI ML Microservice (XGBoost RUL Model)'
          };
        }
        return m;
      }));

      // Refresh live fleet state from backend
      await refreshData(false);

      addToast(
        `ML Prediction completed: RUL ${predResult.predictedRul} cycles, Health ${predResult.healthScore}% (${predResult.riskBand} Risk)`,
        predResult.riskBand === 'Critical' ? 'warning' : 'success'
      );
    }

    return predResult;
  };

  // Confirm ML prediction priority without override
  const confirmReview = async (predictionId, { reviewedBy, reason } = {}) => {
    addToast(`Confirming prediction priority for ${predictionId}...`, 'info');
    try {
      const res = await api.confirmPredictionPriority(predictionId, { reviewedBy, reason });
      addToast(`Prediction ${predictionId} priority confirmed as ${res.data?.prediction?.predictedRisk}`, 'success');
      await refreshData(false);
      return res;
    } catch (err) {
      addToast(`Confirm failed: ${err.message}`, 'warning');
      throw err;
    }
  };

  // Override prediction priority with mandatory human justification
  const overrideReview = async (predictionId, { newPriority, reason, reviewedBy }) => {
    addToast(`Submitting human override for ${predictionId}...`, 'info');
    try {
      const res = await api.overridePredictionPriority(predictionId, { newPriority, reason, reviewedBy });
      addToast(`Priority successfully overridden to ${res.data?.prediction?.maintenancePriority}`, 'success');
      await refreshData(false);
      return res;
    } catch (err) {
      addToast(`Override failed: ${err.message}`, 'warning');
      throw err;
    }
  };

  const resetAllDemoData = () => {
    setMachines(initialMachines);
    setWorkOrders(initialWorkOrders);
    setAlerts([]);
    setPriorityWeights({ risk: 0.50, criticality: 0.25, impact: 0.15, urgency: 0.10 });
    localStorage.removeItem('predictx_machines_v2');
    localStorage.removeItem('predictx_workorders_v2');
    localStorage.removeItem('predictx_alerts_v2');
    addToast('Demo dataset refreshed to default NASA C-MAPSS state', 'info');
    refreshData(false);
  };

  const markAlertAsRead = async (alertId) => {
    setAlerts(prev => prev.map(a => (a.id === alertId || a.notificationId === alertId) ? { ...a, read: true } : a));
    try {
      await api.markNotificationAsRead(alertId);
    } catch (e) {}
  };

  const markAllAlertsAsRead = async () => {
    setAlerts(prev => prev.map(a => ({ ...a, read: true })));
    try {
      await api.markAllNotificationsAsRead();
    } catch (e) {}
  };

  const deleteAlert = async (alertId) => {
    setAlerts(prev => prev.filter(a => a.id !== alertId && a.notificationId !== alertId));
    try {
      await api.deleteNotification(alertId);
    } catch (e) {}
  };

  const clearReadAlerts = async () => {
    setAlerts(prev => prev.filter(a => !a.read));
    try {
      await api.deleteAllReadNotifications();
    } catch (e) {}
  };

  return (
    <AppDataContext.Provider value={{
      machines,
      setMachines,
      workOrders,
      addWorkOrder,
      updateWorkOrderStatus,
      updateMachineStatus,
      dashboardSummary,
      pendingReviewsCount,
      backendStatus,
      isLoading,
      refreshData,
      runMachinePrediction,
      confirmReview,
      overrideReview,
      alerts,
      markAlertAsRead,
      markAllAlertsAsRead,
      deleteAlert,
      clearReadAlerts,
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
