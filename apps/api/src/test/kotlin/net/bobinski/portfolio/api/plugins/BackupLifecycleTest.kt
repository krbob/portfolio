package net.bobinski.portfolio.api.plugins

import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.CoroutineStart
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.awaitCancellation
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

class BackupLifecycleTest {
    @Test
    fun `stopping backup workers waits for cancellation cleanup`() {
        val supervisor = SupervisorJob()
        val cleanupCompleted = CompletableDeferred<Unit>()
        val worker = CoroutineScope(supervisor + Dispatchers.Default).launch(start = CoroutineStart.UNDISPATCHED) {
            try {
                awaitCancellation()
            } finally {
                withContext(NonCancellable) {
                    delay(25)
                    cleanupCompleted.complete(Unit)
                }
            }
        }

        stopBackupWorkers(supervisor)

        assertTrue(worker.isCompleted)
        assertTrue(cleanupCompleted.isCompleted)
    }
}
