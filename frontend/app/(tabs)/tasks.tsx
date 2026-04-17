import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, Modal,
  TextInput, KeyboardAvoidingView, Platform, ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import { COLORS, FONTS, API_URL } from '../../constants';

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowAlert: true, shouldPlaySound: true, shouldSetBadge: true }),
});

type Task = {
  id: string; title: string; description: string;
  due_date: string; priority: string; completed: boolean;
  recurring: string | null; reminder_time: string | null;
};

const PRIORITIES = ['low', 'medium', 'high'];
const PRIORITY_COLORS: Record<string, string> = {
  low: COLORS.cyan, medium: COLORS.saffron, high: COLORS.rose,
};
const PRIORITY_ICONS: Record<string, string> = {
  low: '🟢', medium: '🟡', high: '🔴',
};

export default function TasksScreen() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'done'>('pending');
  const [form, setForm] = useState({
    title: '', description: '', due_date: '', priority: 'medium', recurring: '',
  });

  useEffect(() => {
    requestNotificationPermission();
    fetchTasks();
  }, []);

  const requestNotificationPermission = async () => {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') console.log('Notification permission not granted');
  };

  const fetchTasks = async () => {
    try {
      const res = await fetch(`${API_URL}/api/tasks`);
      const data = await res.json();
      setTasks(data.tasks || []);
    } catch (e) {
      console.error('Tasks fetch error:', e);
    } finally {
      setLoading(false);
    }
  };

  const openAddModal = () => {
    setEditTask(null);
    setForm({ title: '', description: '', due_date: '', priority: 'medium', recurring: '' });
    setModalVisible(true);
  };

  const openEditModal = (task: Task) => {
    setEditTask(task);
    setForm({
      title: task.title, description: task.description,
      due_date: task.due_date || '', priority: task.priority, recurring: task.recurring || '',
    });
    setModalVisible(true);
  };

  const scheduleNotification = async (title: string, dueDate: string) => {
    try {
      const date = new Date(dueDate);
      if (isNaN(date.getTime()) || date <= new Date()) return;
      await Notifications.scheduleNotificationAsync({
        content: { title: '⏰ Task Reminder', body: title, sound: true },
        trigger: { date },
      });
    } catch (e) { console.log('Notification schedule error:', e); }
  };

  const saveTask = async () => {
    if (!form.title.trim()) { Alert.alert('Error', 'Task title is required'); return; }
    try {
      const method = editTask ? 'PUT' : 'POST';
      const url = editTask ? `${API_URL}/api/tasks/${editTask.id}` : `${API_URL}/api/tasks`;
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title, description: form.description,
          due_date: form.due_date || null, priority: form.priority,
          recurring: form.recurring || null,
        }),
      });
      const saved = await res.json();
      if (editTask) {
        setTasks(prev => prev.map(t => t.id === editTask.id ? saved : t));
      } else {
        setTasks(prev => [saved, ...prev]);
        if (form.due_date) await scheduleNotification(form.title, form.due_date);
      }
      setModalVisible(false);
    } catch (e) { Alert.alert('Error', 'Failed to save task'); }
  };

  const toggleTask = async (task: Task) => {
    try {
      const res = await fetch(`${API_URL}/api/tasks/${task.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: !task.completed }),
      });
      const updated = await res.json();
      setTasks(prev => prev.map(t => t.id === task.id ? updated : t));
    } catch (e) { console.error(e); }
  };

  const deleteTask = async (taskId: string) => {
    Alert.alert('Delete Task', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await fetch(`${API_URL}/api/tasks/${taskId}`, { method: 'DELETE' });
            setTasks(prev => prev.filter(t => t.id !== taskId));
          } catch (e) { Alert.alert('Error', 'Failed to delete task'); }
        }
      }
    ]);
  };

  const filteredTasks = tasks.filter(t => {
    if (filter === 'pending') return !t.completed;
    if (filter === 'done') return t.completed;
    return true;
  });

  const stats = { total: tasks.length, done: tasks.filter(t => t.completed).length, pending: tasks.filter(t => !t.completed).length };

  const renderTask = ({ item }: { item: Task }) => (
    <View testID={`task-${item.id}`} style={[styles.taskCard, item.completed && styles.taskCompleted]}>
      <TouchableOpacity
        testID={`toggle-task-${item.id}`}
        onPress={() => toggleTask(item)}
        style={[styles.checkCircle, item.completed && styles.checkCircleActive]}
      >
        {item.completed && <Ionicons name="checkmark" size={14} color={COLORS.bg} />}
      </TouchableOpacity>
      <TouchableOpacity style={styles.taskContent} onPress={() => openEditModal(item)} activeOpacity={0.8}>
        <View style={styles.taskHeader}>
          <Text style={[styles.taskTitle, item.completed && styles.taskTitleDone]} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={styles.priorityEmoji}>{PRIORITY_ICONS[item.priority]}</Text>
        </View>
        {item.description ? (
          <Text style={styles.taskDesc} numberOfLines={1}>{item.description}</Text>
        ) : null}
        <View style={styles.taskMeta}>
          {item.due_date && (
            <View style={styles.metaChip}>
              <Ionicons name="calendar-outline" size={11} color={COLORS.white40} />
              <Text style={styles.metaText}>{item.due_date}</Text>
            </View>
          )}
          {item.recurring && (
            <View style={styles.metaChip}>
              <Ionicons name="repeat" size={11} color={COLORS.cyan} />
              <Text style={[styles.metaText, { color: COLORS.cyan }]}>{item.recurring}</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
      <TouchableOpacity testID={`delete-task-${item.id}`} onPress={() => deleteTask(item.id)} style={styles.deleteBtn}>
        <Ionicons name="trash-outline" size={16} color={COLORS.white40} />
      </TouchableOpacity>
    </View>
  );

  return (
    <LinearGradient colors={['#0A0A14', COLORS.bg]} style={styles.gradient}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Tasks & Reminders</Text>
            <Text style={styles.headerSub}>{stats.pending} pending · {stats.done} done</Text>
          </View>
          <TouchableOpacity testID="add-task-btn" onPress={openAddModal} activeOpacity={0.8}>
            <LinearGradient colors={[COLORS.cyan, COLORS.indigo]} style={styles.addBtn}>
              <Ionicons name="add" size={22} color={COLORS.bg} />
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          {[
            { label: 'Total', value: stats.total, color: COLORS.white70 },
            { label: 'Pending', value: stats.pending, color: COLORS.saffron },
            { label: 'Done', value: stats.done, color: '#00E676' },
          ].map((s, i) => (
            <BlurView key={i} intensity={12} tint="dark" style={styles.statCard}>
              <Text style={[styles.statValue, { color: s.color }]}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </BlurView>
          ))}
        </View>

        {/* Filter Tabs */}
        <View style={styles.filterRow}>
          {(['all', 'pending', 'done'] as const).map(f => (
            <TouchableOpacity
              key={f}
              testID={`filter-${f}`}
              onPress={() => setFilter(f)}
              style={[styles.filterBtn, filter === f && styles.filterBtnActive]}
              activeOpacity={0.7}
            >
              <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading ? (
          <ActivityIndicator color={COLORS.cyan} style={{ marginTop: 40 }} />
        ) : filteredTasks.length === 0 ? (
          <View style={styles.emptyState} testID="empty-tasks">
            <Text style={styles.emptyEmoji}>📝</Text>
            <Text style={styles.emptyTitle}>No tasks here</Text>
            <Text style={styles.emptyDesc}>Tap + to add your first task</Text>
          </View>
        ) : (
          <FlatList
            data={filteredTasks}
            renderItem={renderTask}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            testID="tasks-list"
          />
        )}

        {/* Add/Edit Task Modal */}
        <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
            <BlurView intensity={30} tint="dark" style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle} testID="modal-title">{editTask ? 'Edit Task' : 'New Task'}</Text>
                <TouchableOpacity onPress={() => setModalVisible(false)}>
                  <Ionicons name="close" size={24} color={COLORS.white70} />
                </TouchableOpacity>
              </View>

              <TextInput
                testID="task-title-input"
                style={styles.modalInput}
                placeholder="Task title..."
                placeholderTextColor={COLORS.white40}
                value={form.title}
                onChangeText={v => setForm(p => ({ ...p, title: v }))}
              />
              <TextInput
                testID="task-desc-input"
                style={[styles.modalInput, styles.textArea]}
                placeholder="Description (optional)..."
                placeholderTextColor={COLORS.white40}
                value={form.description}
                onChangeText={v => setForm(p => ({ ...p, description: v }))}
                multiline
                numberOfLines={2}
              />
              <TextInput
                testID="task-date-input"
                style={styles.modalInput}
                placeholder="Due date (YYYY-MM-DD)..."
                placeholderTextColor={COLORS.white40}
                value={form.due_date}
                onChangeText={v => setForm(p => ({ ...p, due_date: v }))}
              />

              <Text style={styles.fieldLabel}>Priority</Text>
              <View style={styles.priorityRow}>
                {PRIORITIES.map(p => (
                  <TouchableOpacity
                    key={p}
                    testID={`priority-${p}`}
                    onPress={() => setForm(prev => ({ ...prev, priority: p }))}
                    style={[styles.priorityBtn, form.priority === p && { borderColor: PRIORITY_COLORS[p], backgroundColor: PRIORITY_COLORS[p] + '22' }]}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.priorityBtnText, form.priority === p && { color: PRIORITY_COLORS[p] }]}>
                      {PRIORITY_ICONS[p]} {p}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity testID="save-task-btn" onPress={saveTask} activeOpacity={0.85} style={styles.saveBtn}>
                <LinearGradient colors={[COLORS.cyan, COLORS.indigo]} style={styles.saveBtnGrad}>
                  <Text style={styles.saveBtnText}>{editTask ? 'Update Task' : 'Add Task'}</Text>
                </LinearGradient>
              </TouchableOpacity>
            </BlurView>
          </KeyboardAvoidingView>
        </Modal>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  safeArea: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12 },
  headerTitle: { fontFamily: FONTS.heading, fontSize: 24, color: COLORS.white, letterSpacing: -0.5 },
  headerSub: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.white40, marginTop: 2 },
  addBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  statsRow: { flexDirection: 'row', gap: 12, paddingHorizontal: 20, marginBottom: 16 },
  statCard: { flex: 1, alignItems: 'center', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: COLORS.border, backgroundColor: 'rgba(18,18,26,0.8)' },
  statValue: { fontFamily: FONTS.heading, fontSize: 24 },
  statLabel: { fontFamily: FONTS.body, fontSize: 11, color: COLORS.white40, marginTop: 2 },
  filterRow: { flexDirection: 'row', paddingHorizontal: 20, gap: 8, marginBottom: 12 },
  filterBtn: { borderRadius: 20, paddingHorizontal: 16, paddingVertical: 7, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.white05 },
  filterBtnActive: { borderColor: COLORS.cyan, backgroundColor: COLORS.cyanGlow },
  filterText: { fontFamily: FONTS.bodySemi, fontSize: 13, color: COLORS.white40 },
  filterTextActive: { color: COLORS.cyan },
  listContent: { paddingHorizontal: 20, paddingBottom: 100 },
  taskCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(18,18,26,0.85)', borderRadius: 16, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: COLORS.border, gap: 12 },
  taskCompleted: { opacity: 0.5 },
  checkCircle: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: COLORS.white40, alignItems: 'center', justifyContent: 'center' },
  checkCircleActive: { backgroundColor: COLORS.cyan, borderColor: COLORS.cyan },
  taskContent: { flex: 1 },
  taskHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  taskTitle: { fontFamily: FONTS.bodySemi, fontSize: 15, color: COLORS.white, flex: 1 },
  taskTitleDone: { textDecorationLine: 'line-through', color: COLORS.white40 },
  priorityEmoji: { fontSize: 14, marginLeft: 8 },
  taskDesc: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.white40, marginTop: 3 },
  taskMeta: { flexDirection: 'row', gap: 8, marginTop: 6 },
  metaChip: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  metaText: { fontFamily: FONTS.body, fontSize: 11, color: COLORS.white40 },
  deleteBtn: { padding: 4 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontFamily: FONTS.headingSemi, fontSize: 18, color: COLORS.white, marginBottom: 6 },
  emptyDesc: { fontFamily: FONTS.body, fontSize: 14, color: COLORS.white40 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.7)' },
  modalContent: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, borderWidth: 1, borderColor: COLORS.border, backgroundColor: 'rgba(12,12,20,0.95)' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontFamily: FONTS.headingSemi, fontSize: 20, color: COLORS.white },
  modalInput: { backgroundColor: COLORS.white05, borderWidth: 1, borderColor: COLORS.border, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12, color: COLORS.white, fontFamily: FONTS.body, fontSize: 15, marginBottom: 12 },
  textArea: { height: 72, textAlignVertical: 'top' },
  fieldLabel: { fontFamily: FONTS.bodySemi, fontSize: 13, color: COLORS.white40, marginBottom: 8 },
  priorityRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  priorityBtn: { flex: 1, borderRadius: 12, paddingVertical: 10, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center' },
  priorityBtnText: { fontFamily: FONTS.bodySemi, fontSize: 13, color: COLORS.white40, textTransform: 'capitalize' },
  saveBtn: { borderRadius: 16, overflow: 'hidden' },
  saveBtnGrad: { paddingVertical: 15, alignItems: 'center' },
  saveBtnText: { fontFamily: FONTS.headingSemi, fontSize: 16, color: COLORS.bg },
});
