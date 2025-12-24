// js/views/client/timerState.js

// 定数
export const LOCAL_STATUS_KEY = "gyomu_timer_current_status";
export const WORKER_URL = "https://muddy-night-4bd4.sora-yamashita.workers.dev";

// 状態変数（モジュールスコープ）
let state = {
    timerInterval: null,
    startTime: null,
    currentTask: null,
    currentGoalId: null,
    currentGoalTitle: null,
    preBreakTask: null,
    midnightStopTimer: null,
    hasContributedToCurrentGoal: false,
    activeReservations: [],
    lastBreakNotificationTime: 0,
    lastEncouragementTime: 0
};

// ゲッター
export const getTimerInterval = () => state.timerInterval;
export const getStartTime = () => state.startTime;
export const getCurrentTask = () => state.currentTask;
export const getCurrentGoalId = () => state.currentGoalId;
export const getCurrentGoalTitle = () => state.currentGoalTitle;
export const getPreBreakTask = () => state.preBreakTask;
export const getMidnightStopTimer = () => state.midnightStopTimer;
export const getHasContributed = () => state.hasContributedToCurrentGoal;
export const getActiveReservations = () => state.activeReservations;
export const getLastBreakNotificationTime = () => state.lastBreakNotificationTime;
export const getLastEncouragementTime = () => state.lastEncouragementTime;
export const getIsWorking = () => !!state.currentTask && !!state.startTime;

// セッター
export const setTimerInterval = (v) => { state.timerInterval = v; };
export const setStartTime = (v) => { state.startTime = v; };
export const setCurrentTask = (v) => { state.currentTask = v; };
export const setCurrentGoalId = (v) => { state.currentGoalId = v; };
export const setCurrentGoalTitle = (v) => { state.currentGoalTitle = v; };
export const setPreBreakTask = (v) => { state.preBreakTask = v; };
export const setMidnightStopTimer = (v) => { state.midnightStopTimer = v; };
export const setHasContributed = (v) => { state.hasContributedToCurrentGoal = v; };
export const setActiveReservations = (v) => { state.activeReservations = v; };
export const setLastBreakNotificationTime = (v) => { state.lastBreakNotificationTime = v; };
export const setLastEncouragementTime = (v) => { state.lastEncouragementTime = v; };

// まとめてリセットするヘルパー
export function resetStateVariables() {
    state.currentTask = null;
    state.currentGoalId = null;
    state.currentGoalTitle = null;
    state.startTime = null;
    state.preBreakTask = null;
    state.hasContributedToCurrentGoal = false;
    state.lastBreakNotificationTime = 0;
    state.lastEncouragementTime = 0;
    // timerIntervalとmidnightStopTimerは別途クリアが必要
}
