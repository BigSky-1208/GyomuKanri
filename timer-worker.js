// timer-worker.js (中身はこれだけでOK)
let timerInterval = null;
self.onmessage = function(e) {
    if (e.data === 'start') {
        if (timerInterval) clearInterval(timerInterval);
        timerInterval = setInterval(() => {
            self.postMessage('tick');
        }, 1000);
    } else if (e.data === 'stop') {
        if (timerInterval) clearInterval(timerInterval);
    }
};
