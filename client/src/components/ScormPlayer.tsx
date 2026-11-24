import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { TrainingContentProgress } from "@shared/schema";

interface ScormPlayerProps {
  contentId: string;
  scormVersion: string | null; // "scorm12" | "scorm2004"
  scormLaunchPath: string | null;
  title: string;
}

// The SCORM runtime bridge. Injects the version-appropriate API object onto THIS component's own
// window (the iframe's parent) before the iframe ever mounts - SCORM content walks up window.parent
// looking for this object by name, so it must already be there when the package's own launch page
// starts running, not added afterward. The object living on the React app's window (which never
// unloads) rather than inside the iframe is also why multi-page SCOs work at all: the iframe's own
// document can navigate freely within the package without losing API state.
export default function ScormPlayer({ contentId, scormVersion, scormLaunchPath, title }: ScormPlayerProps) {
  const { user } = useAuth();
  const [apiReady, setApiReady] = useState(false);
  const cmiRef = useRef<Record<string, string>>({});
  const isScorm2004 = scormVersion === 'scorm2004';
  // How this package is opened: from a separate content address with a signed link (packages cannot then reach Capera's session), or, when none is
  // configured, from the application's own address with the SCORM API on this window as before.
  const [launch, setLaunch] = useState<{ separate: boolean; url: string; origin?: string } | null>(null);
  const [launchError, setLaunchError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLaunch(null); setLaunchError(false);
    fetch(`/api/training-content/${contentId}/scorm-launch`, { credentials: 'include' })
      .then(r => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then(j => { if (!cancelled) setLaunch(j); })
      .catch(() => { if (!cancelled) setLaunchError(true); });
    return () => { cancelled = true; };
  }, [contentId]);

  // Separate content address: the package reports its values by message. Only a message from that address, about this package, is accepted, and it is
  // saved as the signed-in person (the package itself has no session).
  useEffect(() => {
    if (!launch?.separate || !launch.origin) return;
    let latest: Record<string, string> | null = null;
    const save = () => {
      if (!latest) return;
      const cmiData = latest; latest = null;
      apiRequest('PUT', `/api/training-content/${contentId}/scorm-progress`, { cmiData })
        .then(() => queryClient.invalidateQueries({ queryKey: ['/api/trainings'] }))
        .catch(err => console.error('Error saving SCORM progress:', err));
    };
    const onMessage = (ev: MessageEvent) => {
      if (ev.origin !== launch.origin) return;
      const d = ev.data;
      if (!d || d.capera !== 'scorm' || d.type !== 'commit' || d.contentId !== contentId || !d.cmi || typeof d.cmi !== 'object') return;
      const clean: Record<string, string> = {};
      let n = 0;
      for (const [k, v] of Object.entries(d.cmi as Record<string, unknown>)) {
        if (++n > 600) break;
        if (/^cmi\.[\w.\-]{1,120}$/.test(k) && typeof v === 'string' && v.length <= 100000) clean[k] = v;
      }
      latest = clean;
      save();
    };
    window.addEventListener('message', onMessage);
    return () => { window.removeEventListener('message', onMessage); };
  }, [launch, contentId]);

  useEffect(() => {
    if (!launch || launch.separate) return; // the bridge above does this when the package is served from its own address
    let cancelled = false;

    async function init() {
      // Seed from any prior session's persisted CMI state, so a returning learner resumes rather
      // than starting over - GetValue calls the package makes on Initialize need this available
      // immediately, not fetched lazily on first access.
      let priorProgress: TrainingContentProgress | null = null;
      try {
        const res = await fetch(`/api/training-content/${contentId}/scorm-progress`, { credentials: 'include' });
        if (res.ok) priorProgress = await res.json();
      } catch {
        // No prior progress is a normal first-launch case, not an error worth surfacing.
      }
      if (cancelled) return;

      const priorCmi = (priorProgress?.cmiData as Record<string, string> | null) ?? {};
      const learnerName = user ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.email || '' : '';
      const hasResumeState = !!priorProgress?.suspendData;

      cmiRef.current = {
        ...priorCmi,
        ...(isScorm2004 ? {
          'cmi.learner_id': user?.id ?? '',
          'cmi.learner_name': learnerName,
          'cmi.credit': 'credit',
          'cmi.mode': 'normal',
          'cmi.entry': hasResumeState ? 'resume' : 'ab-initio',
          'cmi.completion_status': priorCmi['cmi.completion_status'] ?? 'not attempted',
          'cmi.success_status': priorCmi['cmi.success_status'] ?? 'unknown',
          'cmi.suspend_data': priorProgress?.suspendData ?? priorCmi['cmi.suspend_data'] ?? '',
        } : {
          'cmi.core.student_id': user?.id ?? '',
          'cmi.core.student_name': learnerName,
          'cmi.core.credit': 'credit',
          'cmi.core.lesson_mode': 'normal',
          'cmi.core.entry': hasResumeState ? 'resume' : '',
          'cmi.core.lesson_status': priorCmi['cmi.core.lesson_status'] ?? 'not attempted',
          'cmi.suspend_data': priorProgress?.suspendData ?? priorCmi['cmi.suspend_data'] ?? '',
        }),
      };

      const flushCommit = () => {
        apiRequest('PUT', `/api/training-content/${contentId}/scorm-progress`, { cmiData: { ...cmiRef.current } })
          // Partial key match - invalidates every /api/trainings/:id/content-progress query
          // regardless of which training it's for, since this component doesn't know trainingId.
          .then(() => queryClient.invalidateQueries({ queryKey: ['/api/trainings'] }))
          .catch(err => console.error('Error saving SCORM progress:', err));
      };

      // beforeunload can't reliably await a normal fetch - the browser may tear the page down
      // before it completes. sendBeacon is built specifically for this: a small, best-effort POST
      // guaranteed to be attempted even as the page unloads. Regular Commit/Terminate calls during
      // normal interaction use the awaited fetch above instead, which works fine there.
      const flushOnUnload = () => {
        const blob = new Blob([JSON.stringify({ cmiData: { ...cmiRef.current } })], { type: 'application/json' });
        navigator.sendBeacon?.(`/api/training-content/${contentId}/scorm-progress`, blob);
      };
      window.addEventListener('beforeunload', flushOnUnload);

      const ok = () => 'true';
      const getValue = (element: string) => cmiRef.current[element] ?? '';
      const setValue = (element: string, value: string) => { cmiRef.current[element] = value; return 'true'; };
      const noError = () => '0';
      const noErrorString = () => '';

      if (isScorm2004) {
        (window as any).API_1484_11 = {
          Initialize: ok,
          Terminate: () => { flushCommit(); return 'true'; },
          GetValue: getValue,
          SetValue: setValue,
          Commit: () => { flushCommit(); return 'true'; },
          GetLastError: noError,
          GetErrorString: noErrorString,
          GetDiagnostic: noErrorString,
        };
      } else {
        (window as any).API = {
          LMSInitialize: ok,
          LMSFinish: () => { flushCommit(); return 'true'; },
          LMSGetValue: getValue,
          LMSSetValue: setValue,
          LMSCommit: () => { flushCommit(); return 'true'; },
          LMSGetLastError: noError,
          LMSGetErrorString: noErrorString,
          LMSGetDiagnostic: noErrorString,
        };
      }

      (init as any)._cleanup = () => {
        flushCommit();
        window.removeEventListener('beforeunload', flushOnUnload);
        if (isScorm2004) delete (window as any).API_1484_11;
        else delete (window as any).API;
      };

      if (!cancelled) setApiReady(true);
    }

    init();

    return () => {
      cancelled = true;
      (init as any)._cleanup?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentId, isScorm2004, launch]);

  if (!scormLaunchPath) {
    return <div className="text-center py-8 text-muted-foreground">This SCORM package has no launch file configured.</div>;
  }

  if (launchError) {
    return <div className="text-center py-8 text-muted-foreground">This learning could not be opened. Please try again.</div>;
  }

  return (
    <div className="w-full h-full min-h-[70vh]">
      {launch && (launch.separate || apiReady) ? (
        <iframe
          src={launch.url}
          title={title}
          className="w-full h-full min-h-[70vh] rounded-md border"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          data-testid="iframe-scorm-player"
        />
      ) : (
        <div className="text-center py-8 text-muted-foreground">Loading...</div>
      )}
    </div>
  );
}
