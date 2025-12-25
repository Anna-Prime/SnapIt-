import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Camera, Image as ImageIcon, Settings, X, Download, RefreshCw, Zap, Trash2, ChevronLeft, ChevronRight, Sliders, Sun, Moon, Contrast, Droplet, Heart, ZoomIn, ZoomOut, Video, Play, Pause } from 'lucide-react';

// --- Types & Constants ---

interface ColorPreset {
  name: string;
  value: string; // hex
  label: string;
  textColor: string;
}

const PRESETS: ColorPreset[] = [
  { name: 'Studio White', value: '#FFFFFF', label: 'Clean', textColor: '#000000' },
  { name: 'Warm Tungsten', value: '#FFD1B3', label: 'Warm', textColor: '#000000' },
  { name: 'Golden Hour', value: '#FFC000', label: 'Gold', textColor: '#000000' },
  { name: 'Sunset', value: '#FF4500', label: 'Sunset', textColor: '#FFFFFF' },
  { name: 'Miami Pink', value: '#FF1493', label: 'Neon', textColor: '#FFFFFF' },
  { name: 'Cyber Purple', value: '#9400D3', label: 'Cyber', textColor: '#FFFFFF' },
  { name: 'Electric Lime', value: '#CCFF00', label: 'Lime', textColor: '#000000' },
  { name: 'Neon Cyan', value: '#00FFDD', label: 'Cyan', textColor: '#000000' },
  { name: 'Plasma', value: '#7F00FF', label: 'Plas', textColor: '#FFFFFF' },
  { name: 'Royal Blue', value: '#4169E1', label: 'Royal', textColor: '#FFFFFF' },
  { name: 'Deep Ocean', value: '#003366', label: 'Deep', textColor: '#FFFFFF' },
  { name: 'Toxic Green', value: '#39FF14', label: 'Toxic', textColor: '#000000' },
  { name: 'Hot Magenta', value: '#FF00FF', label: 'Hot', textColor: '#FFFFFF' },
  { name: 'Vampire Red', value: '#8B0000', label: 'Vamp', textColor: '#FFFFFF' },
  { name: 'Peach Fuzz', value: '#FFDAB9', label: 'Peach', textColor: '#000000' },
];

interface GalleryItem {
  type: 'image' | 'video';
  url: string;
  timestamp: number;
}

// --- Helper Components ---

const Modal = ({ 
  isOpen, 
  onClose, 
  children 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  children?: React.ReactNode 
}) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-2xl animate-fade-in p-6">
      <div className="w-full max-w-md bg-zinc-900/80 border border-white/10 rounded-[2rem] overflow-hidden relative shadow-2xl animate-scale-up backdrop-blur-md">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-10 h-10 bg-white/10 rounded-full flex items-center justify-center text-white hover:bg-white/20 transition-colors backdrop-blur-sm"
        >
          <X size={20} />
        </button>
        {children}
      </div>
    </div>
  );
};

// --- Main App Component ---

const App: React.FC = () => {
  // Navigation State
  const [activeTab, setActiveTab] = useState<'camera' | 'banna' | 'gallery' | 'settings'>('camera');
  
  // Mode State
  const [mode, setMode] = useState<'photo' | 'video'>('photo');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);

  // Camera Mode State
  const [activeColor, setActiveColor] = useState<string>(PRESETS[0].value);
  const [brightness, setBrightness] = useState<number>(80);
  
  // Banna Effect Mode State
  const [bBrightness, setBBrightness] = useState(100);
  const [bContrast, setBContrast] = useState(100);
  const [bWarmth, setBWarmth] = useState(0);
  const [bSaturation, setBSaturation] = useState(100);
  
  // Shared State
  const [zoom, setZoom] = useState<number>(1);
  const [timer, setTimer] = useState<number>(0); 
  const [capturedItem, setCapturedItem] = useState<GalleryItem | null>(null);
  const [galleryItems, setGalleryItems] = useState<GalleryItem[]>([]);
  const [isCountingDown, setIsCountingDown] = useState<boolean>(false);
  const [countdownValue, setCountdownValue] = useState<number>(3);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [flashMode, setFlashMode] = useState(false);
  const [mirrorMode, setMirrorMode] = useState(true);

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const animationFrameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // --- Camera Logic ---

  const startCamera = async () => {
    // Define constraints outside try block to be available in catch block
    const constraints = {
      video: {
        facingMode: 'user',
        width: { ideal: 4096 }, 
        height: { ideal: 2160 },
        aspectRatio: { ideal: 0.75 } 
      },
      audio: true
    };

    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setStreamError(null);
    } catch (err) {
      console.error("Camera access error:", err);
      // Try video only if audio fails
      try {
         const videoOnlyStream = await navigator.mediaDevices.getUserMedia({ ...constraints, audio: false });
         streamRef.current = videoOnlyStream;
         if (videoRef.current) videoRef.current.srcObject = videoOnlyStream;
         setStreamError(null);
      } catch (e2) {
         setStreamError("Please allow camera access.");
      }
    }
  };

  useEffect(() => {
    if (activeTab === 'camera' || activeTab === 'banna') {
      startCamera();
    }
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [activeTab]);

  const scrollColors = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const scrollAmount = 200;
      scrollContainerRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  // --- Core Rendering Logic (Used for Photo & Video) ---
  const renderToCanvas = (canvas: HTMLCanvasElement, video: HTMLVideoElement) => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // 1. Clear & Setup
      // Note: Canvas size should be set before calling this in the loop or once before shot

      ctx.save();

      // Mirroring Logic
      if (mirrorMode) {
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
      }

      // Calculate Source Rect for Zoom
      let sx, sy, sWidth, sHeight;

      if (activeTab === 'banna') {
        // Source crop logic for square aspect
        const size = Math.min(video.videoWidth, video.videoHeight);
        const sSize = size / zoom;
        sWidth = sSize;
        sHeight = sSize;
        sx = (video.videoWidth - sSize) / 2;
        sy = (video.videoHeight - sSize) / 2;
        
        // Apply Filters directly to context for Banna Mode
        ctx.filter = `brightness(${bBrightness}%) contrast(${bContrast}%) saturate(${bSaturation}%)`;

      } else {
        // Source crop logic for portrait
        sWidth = video.videoWidth / zoom;
        sHeight = video.videoHeight / zoom;
        sx = (video.videoWidth - sWidth) / 2;
        sy = (video.videoHeight - sHeight) / 2;
      }

      // Draw Video with Zoom Crop
      ctx.drawImage(video, sx, sy, sWidth, sHeight, 0, 0, canvas.width, canvas.height);

      // Reset Filter
      ctx.filter = 'none';

      // Apply Effects (Standard Mode only)
      if (activeTab !== 'banna') {
         if (activeColor !== '#FFFFFF') {
             ctx.globalCompositeOperation = 'soft-light';
             ctx.fillStyle = activeColor;
             ctx.globalAlpha = 0.1 + (brightness / 200); 
             ctx.fillRect(0, 0, canvas.width, canvas.height);
             
             ctx.globalCompositeOperation = 'overlay';
             ctx.globalAlpha = 0.1;
             ctx.fillRect(0, 0, canvas.width, canvas.height);
         }
 
         // Vignette
         const gradient = ctx.createRadialGradient(
             canvas.width / 2, canvas.height / 2, canvas.height / 3,
             canvas.width / 2, canvas.height / 2, canvas.height
         );
         gradient.addColorStop(0, 'rgba(0,0,0,0)');
         gradient.addColorStop(1, 'rgba(0,0,0,0.3)');
         ctx.fillStyle = gradient;
         ctx.globalAlpha = 1.0;
         ctx.globalCompositeOperation = 'source-over';
         ctx.fillRect(0, 0, canvas.width, canvas.height);
      } else {
          // Banna Mode Overlays
          // Apply Warmth Overlay (Golden Hour Effect)
          if (bWarmth > 0) {
            ctx.globalCompositeOperation = 'overlay';
            ctx.fillStyle = '#FFB800'; // Gold
            ctx.globalAlpha = (bWarmth / 100) * 0.4; // Cap at 40% intensity
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.globalCompositeOperation = 'source-over';
          }
      }

      ctx.restore();

      // --- ADD PREMIUM WATERMARK ---
      ctx.save();
      const fontSize = Math.max(20, canvas.width * 0.04); 
      ctx.font = `italic 600 ${fontSize}px "Playfair Display", serif`;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'bottom';
      
      // Shadow
      ctx.shadowColor = 'rgba(0,0,0,0.8)';
      ctx.shadowBlur = 3;
      ctx.shadowOffsetX = 1;
      ctx.shadowOffsetY = 1;

      // Text Color (Gold)
      ctx.fillStyle = '#FFD700'; 
      
      const padding = fontSize * 0.8;
      ctx.fillText("Banna ki lugai 😇", canvas.width - padding, canvas.height - padding);
      ctx.restore();
  };

  const setupCanvasSize = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (activeTab === 'banna') {
      const size = Math.min(video.videoWidth, video.videoHeight);
      canvas.width = size;
      canvas.height = size;
    } else {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    }
  }

  // --- Photo Capture ---
  const takePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    setupCanvasSize();
    
    // Flash
    setFlashMode(true);
    setTimeout(() => setFlashMode(false), 200);

    renderToCanvas(canvasRef.current, videoRef.current);
    
    const dataUrl = canvasRef.current.toDataURL('image/png', 1.0);
    const item: GalleryItem = { type: 'image', url: dataUrl, timestamp: Date.now() };
    setCapturedItem(item);
    setGalleryItems(prev => [item, ...prev]);
  }, [mirrorMode, activeColor, brightness, activeTab, bBrightness, bContrast, bSaturation, bWarmth, zoom]);

  // --- Video Recording ---
  const startRecording = useCallback(() => {
     if (!videoRef.current || !canvasRef.current) return;
     setupCanvasSize();

     setIsRecording(true);
     setRecordingTime(0);
     recordedChunksRef.current = [];

     // Start Rendering Loop
     const loop = () => {
        if (videoRef.current && canvasRef.current) {
          renderToCanvas(canvasRef.current, videoRef.current);
        }
        animationFrameRef.current = requestAnimationFrame(loop);
     };
     loop();

     // Create Stream from Canvas (30fps)
     const canvasStream = canvasRef.current.captureStream(30);
     
     // Add Audio Track if available
     if (streamRef.current) {
        const audioTrack = streamRef.current.getAudioTracks()[0];
        if (audioTrack) {
           canvasStream.addTrack(audioTrack);
        }
     }

     // Init Recorder
     try {
       const recorder = new MediaRecorder(canvasStream, { mimeType: 'video/webm;codecs=vp9' });
       
       recorder.ondataavailable = (e) => {
         if (e.data.size > 0) {
           recordedChunksRef.current.push(e.data);
         }
       };

       recorder.onstop = () => {
         const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
         const url = URL.createObjectURL(blob);
         const item: GalleryItem = { type: 'video', url: url, timestamp: Date.now() };
         setCapturedItem(item);
         setGalleryItems(prev => [item, ...prev]);
         
         // Cleanup
         if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
       };

       recorder.start();
       mediaRecorderRef.current = recorder;

       // Timer
       const timerInterval = setInterval(() => {
          setRecordingTime(prev => prev + 1);
       }, 1000);

       // Store interval id in a way we can clear it? 
       // We can just rely on isRecording effect, but simplest is to attach a stop handler
       const originalStop = recorder.stop;
       recorder.stop = function() {
          clearInterval(timerInterval);
          originalStop.call(recorder);
       }

     } catch (e) {
       console.error("Recording failed", e);
       setIsRecording(false);
       if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
     }

  }, [mirrorMode, activeColor, brightness, activeTab, bBrightness, bContrast, bSaturation, bWarmth, zoom]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }, []);

  const handleShutter = () => {
    if (mode === 'photo') {
      if (timer > 0) {
        setIsCountingDown(true);
        setCountdownValue(timer);
        let count = timer;
        const interval = setInterval(() => {
          count -= 1;
          setCountdownValue(count);
          if (count === 0) {
            clearInterval(interval);
            setIsCountingDown(false);
            takePhoto();
          }
        }, 1000);
      } else {
        takePhoto();
      }
    } else {
      // Video Mode
      if (isRecording) {
        stopRecording();
      } else {
        startRecording();
      }
    }
  };

  const handleDownload = (item: GalleryItem) => {
    const link = document.createElement('a');
    link.href = item.url;
    link.download = `banna-capture-${item.timestamp}.${item.type === 'video' ? 'webm' : 'png'}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDelete = (index: number) => {
    const newItems = [...galleryItems];
    newItems.splice(index, 1);
    setGalleryItems(newItems);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // --- Render ---

  return (
    <div className="relative w-full min-h-screen font-sans text-slate-900 overflow-x-hidden bg-black select-none flex flex-col items-center">
      
      {/* Dynamic Background */}
      <div 
        className="fixed inset-0 z-0 transition-all duration-1000 ease-in-out"
        style={{ 
          backgroundColor: activeTab === 'camera' ? activeColor : '#000000',
          opacity: activeTab === 'camera' ? 0.3 : 1
        }}
      />
      
      {/* Flash Overlay */}
      <div className={`fixed inset-0 bg-white z-[100] pointer-events-none transition-opacity duration-200 ease-out ${flashMode ? 'opacity-100' : 'opacity-0'}`} />

      {/* Header */}
      <header className="w-full flex justify-center items-center py-6 px-4 z-20 absolute top-0">
          <div className="bg-black/40 backdrop-blur-xl px-8 py-3 rounded-full border border-white/10 shadow-2xl">
             <h1 className="font-playfair text-xl font-bold tracking-widest text-white drop-shadow-md">
               Light Trap <span className="text-[10px] font-sans font-black text-yellow-400 align-top ml-1 tracking-tight">STUDIO</span>
             </h1>
          </div>
      </header>

      {/* --- MAIN CONTENT AREA --- */}
      <div className="relative z-10 flex flex-col lg:flex-row items-center justify-center w-full min-h-screen pt-24 pb-32 lg:pb-0 lg:px-20 gap-8 lg:gap-16 max-w-7xl">
        
        {/* ==========================================================
            TAB: CAMERA (Color Gels)
           ========================================================== */}
        {activeTab === 'camera' && (
          <>
            {/* LEFT SIDE: Viewfinder */}
            <div className="w-full max-w-md lg:max-w-lg lg:order-1">
              <div className="relative aspect-[3/4] w-full bg-black rounded-[3rem] overflow-hidden shadow-2xl ring-1 ring-white/20">
                {/* Pro Badges */}
                <div className="absolute top-6 left-0 w-full z-20 px-6 flex justify-between items-start">
                  <div className="bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 flex items-center gap-2">
                    {isRecording ? (
                       <>
                        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                        <span className="text-[10px] font-bold text-white tracking-widest">REC {formatTime(recordingTime)}</span>
                       </>
                    ) : (
                       <>
                        <span className="w-2 h-2 rounded-full bg-green-500"></span>
                        <span className="text-[10px] font-bold text-white tracking-widest">LIVE</span>
                       </>
                    )}
                  </div>
                </div>

                {/* Overlays (Only if not recording - canvas has filters baked in, video element should show preview) */}
                {/* Actually, for recording, we want the preview to match. The video element needs CSS transforms. 
                    The canvas drawing loop handles the recording stream. */}
                <div 
                  className="absolute inset-0 z-10 pointer-events-none mix-blend-soft-light transition-colors duration-300"
                  style={{ backgroundColor: activeColor, opacity: 0.1 + (brightness / 250) }}
                />

                {/* Video */}
                <video 
                  ref={videoRef}
                  autoPlay playsInline muted
                  className="w-full h-full object-cover transition-transform duration-200 ease-out"
                  style={{ transform: `scale(${mirrorMode ? -zoom : zoom}, ${zoom})` }}
                />

                {isCountingDown && (
                  <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in">
                    <span className="text-[120px] font-black text-white animate-ping drop-shadow-2xl font-playfair">{countdownValue}</span>
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT SIDE: Controls */}
            <div className="w-full max-w-md lg:max-w-sm px-2 flex flex-col gap-6 lg:order-2 lg:h-[80vh] lg:justify-center">
              
              {/* Color Scroll */}
              <div className="bg-gradient-to-r from-zinc-900/90 to-black/90 backdrop-blur-xl py-5 px-1 rounded-[2.5rem] border border-white/10 shadow-2xl relative group">
                <button onClick={() => scrollColors('left')} className="absolute left-2 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-white/10 hover:bg-white/30 flex items-center justify-center text-white backdrop-blur-md border border-white/10"><ChevronLeft size={16} /></button>
                <button onClick={() => scrollColors('right')} className="absolute right-2 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-white/10 hover:bg-white/30 flex items-center justify-center text-white backdrop-blur-md border border-white/10"><ChevronRight size={16} /></button>
                
                <div ref={scrollContainerRef} className="flex gap-3 overflow-x-auto no-scrollbar px-12 pb-2 pt-2 snap-x scroll-smooth">
                  {PRESETS.map((preset) => (
                    <button
                      key={preset.name}
                      onClick={() => setActiveColor(preset.value)}
                      className={`group/btn flex-shrink-0 snap-center relative w-16 h-20 rounded-2xl transition-all duration-300 flex flex-col items-center justify-end pb-3 overflow-hidden
                        ${activeColor === preset.value ? 'ring-2 ring-white scale-110 shadow-[0_0_25px_rgba(255,255,255,0.4)] z-10' : 'opacity-60 hover:opacity-100 hover:scale-105'}`}
                      style={{ backgroundColor: preset.value }}
                    >
                      <span className="text-[9px] font-bold uppercase tracking-tight relative z-10 transition-colors" style={{ color: preset.textColor }}>{preset.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Controls Group */}
              <div className="bg-zinc-900/80 backdrop-blur-xl px-8 py-6 rounded-[2.5rem] border border-white/10 shadow-lg mx-2 flex flex-col gap-6">
                 
                 {/* Intensity */}
                 <div className="flex flex-col gap-2">
                     <div className="flex justify-between text-white/90">
                        <span className="text-[10px] font-bold uppercase tracking-widest flex items-center gap-2"><Zap size={12} fill="currentColor" /> Intensity</span>
                        <span className="text-[10px] font-mono font-bold">{brightness}%</span>
                     </div>
                     <div className="relative w-full h-6 flex items-center">
                       <input type="range" min="0" max="100" value={brightness} onChange={(e) => setBrightness(Number(e.target.value))} className="absolute z-20 w-full h-full opacity-0 cursor-pointer" />
                       <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full transition-all duration-100 ease-out" style={{ width: `${brightness}%`, backgroundColor: activeColor }} />
                       </div>
                       <div className="absolute h-6 w-6 bg-white rounded-full shadow-lg transition-all duration-100 ease-out pointer-events-none ring-2 ring-black/20" style={{ left: `calc(${brightness}% - 12px)` }} />
                     </div>
                 </div>

                 {/* Zoom Slider */}
                 <div className="flex flex-col gap-2">
                     <div className="flex justify-between text-white/90">
                        <span className="text-[10px] font-bold uppercase tracking-widest flex items-center gap-2"><ZoomIn size={12} /> Magnify</span>
                        <span className="text-[10px] font-mono font-bold">{zoom.toFixed(1)}x</span>
                     </div>
                     <div className="relative w-full h-6 flex items-center">
                       <input type="range" min="1" max="3" step="0.1" value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="absolute z-20 w-full h-full opacity-0 cursor-pointer" />
                       <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full bg-white/40" style={{ width: `${((zoom - 1) / 2) * 100}%` }} />
                       </div>
                       <div className="absolute h-5 w-5 bg-white rounded-full shadow-lg transition-all duration-100 ease-out pointer-events-none ring-2 ring-black/20 flex items-center justify-center" style={{ left: `calc(${((zoom - 1) / 2) * 100}% - 10px)` }}>
                          <span className="text-[6px] font-black text-black">{zoom.toFixed(1)}</span>
                       </div>
                     </div>
                 </div>

              </div>

              {/* Shutter Area */}
              <div className="flex flex-col items-center gap-4 pt-2">
                 
                 {/* Mode Switcher */}
                 <div className="flex items-center gap-6 bg-black/40 backdrop-blur-md rounded-full px-6 py-2 border border-white/5">
                    <button 
                      onClick={() => setMode('photo')} 
                      className={`text-[10px] font-bold tracking-[0.2em] transition-colors ${mode === 'photo' ? 'text-white' : 'text-white/40'}`}
                    >
                      PHOTO
                    </button>
                    <div className="w-px h-3 bg-white/20"></div>
                    <button 
                      onClick={() => setMode('video')} 
                      className={`text-[10px] font-bold tracking-[0.2em] transition-colors ${mode === 'video' ? 'text-white' : 'text-white/40'}`}
                    >
                      VIDEO
                    </button>
                 </div>

                 {/* Shutter Button */}
                 <button 
                   onClick={handleShutter}
                   className={`w-24 h-24 rounded-full border-[6px] border-white/20 flex items-center justify-center relative shadow-[0_0_40px_rgba(0,0,0,0.5)] transition-all hover:scale-105 active:scale-95 bg-black/40 backdrop-blur-sm
                     ${isRecording ? 'border-red-500/50' : ''}`}
                 >
                   <div 
                     className={`rounded-full transition-all duration-300 ${isRecording ? 'w-10 h-10 rounded-md bg-red-500' : 'w-20 h-20 bg-white'}`}
                     style={!isRecording ? { backgroundColor: activeColor, boxShadow: `0 0 20px ${activeColor}80` } : { boxShadow: '0 0 30px #EF4444' }} 
                   />
                 </button>
              </div>
            </div>
          </>
        )}

        {/* ==========================================================
            TAB: BANNA EFFECT MODE (New Premium Mode)
           ========================================================== */}
        {activeTab === 'banna' && (
          <>
            {/* LEFT SIDE: Square Preview with INTEGRATED Capture Button */}
            <div className="w-full max-w-md lg:max-w-lg lg:order-1 relative animate-fade-in">
              <div className="relative w-full aspect-square bg-black rounded-[2rem] overflow-hidden shadow-2xl ring-1 ring-yellow-500/30 group">
                 <video 
                    ref={videoRef}
                    autoPlay playsInline muted
                    className="w-full h-full object-cover transition-transform duration-200 ease-out"
                    style={{
                      filter: `brightness(${bBrightness}%) contrast(${bContrast}%) saturate(${bSaturation}%)`,
                      transform: `scale(${mirrorMode ? -zoom : zoom}, ${zoom})`
                    }}
                  />
                  {/* Warmth Overlay */}
                  <div className="absolute inset-0 pointer-events-none mix-blend-overlay transition-opacity duration-100" style={{ backgroundColor: '#FFB800', opacity: (bWarmth / 100) * 0.4 }} />

                  {/* Status Indicator */}
                  {isRecording ? (
                     <div className="absolute top-6 left-1/2 -translate-x-1/2 z-50 bg-red-500/80 backdrop-blur-md px-4 py-1.5 rounded-full flex items-center gap-2 shadow-lg">
                        <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                        <span className="text-[10px] font-black text-white tracking-widest">{formatTime(recordingTime)}</span>
                     </div>
                  ) : (
                     <div className="absolute top-6 left-1/2 -translate-x-1/2 z-50 flex gap-4 pointer-events-auto">
                        <button 
                          onClick={() => setMode('photo')} 
                          className={`text-[10px] font-bold tracking-widest drop-shadow-md transition-colors ${mode === 'photo' ? 'text-white' : 'text-white/50'}`}
                        >
                          PHOTO
                        </button>
                        <button 
                          onClick={() => setMode('video')} 
                          className={`text-[10px] font-bold tracking-widest drop-shadow-md transition-colors ${mode === 'video' ? 'text-white' : 'text-white/50'}`}
                        >
                          VIDEO
                        </button>
                     </div>
                  )}

                  {isCountingDown && (
                    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                      <span className="text-[120px] font-black text-yellow-400 animate-ping drop-shadow-2xl font-playfair">{countdownValue}</span>
                    </div>
                  )}

                  {/* INTEGRATED CAPTURE BUTTON (Mobile App Style) */}
                  <div className="absolute bottom-6 left-0 w-full flex justify-center z-40">
                     <button 
                      onClick={handleShutter}
                      className={`relative w-20 h-20 rounded-full border-[4px] border-white/80 bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-[0_4px_20px_rgba(0,0,0,0.3)] hover:scale-105 active:scale-95 transition-all
                        ${mode === 'video' ? 'border-red-500/50' : ''}`}
                     >
                       <div 
                        className={`transition-all duration-300 shadow-inner
                          ${isRecording ? 'w-8 h-8 rounded-md bg-red-500' : (mode === 'video' ? 'w-16 h-16 rounded-full bg-red-500' : 'w-16 h-16 rounded-full bg-white')}`} 
                       />
                     </button>
                  </div>
              </div>
            </div>

            {/* RIGHT SIDE: Adjustment Panel */}
            <div className="w-full max-w-md lg:max-w-sm px-2 lg:order-2 lg:h-[80vh] flex flex-col justify-center animate-fade-in">
              <div className="bg-[#1A1A1A]/95 border border-yellow-500/20 backdrop-blur-xl rounded-[2.5rem] p-6 shadow-2xl">
                  
                  {/* Header */}
                  <div className="flex items-center justify-between mb-6 border-b border-white/5 pb-4">
                     <span className="text-yellow-500 font-playfair font-bold text-lg italic">Banna FX</span>
                     <div className="flex gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-yellow-500/50"></div>
                        <div className="w-1.5 h-1.5 rounded-full bg-yellow-500/50"></div>
                     </div>
                  </div>

                  {/* Zoom Control for Banna Mode */}
                  <div className="mb-6 pb-6 border-b border-white/5">
                     <div className="flex justify-between items-center mb-3">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-white/80 flex items-center gap-2">
                           <ZoomIn size={12} className="text-yellow-500" /> Zoom
                        </span>
                        <span className="text-[10px] font-mono text-yellow-500">{zoom.toFixed(1)}x</span>
                     </div>
                     <div className="h-8 w-full relative flex items-center px-1">
                        <ZoomOut size={14} className="text-white/30 mr-2" />
                        <div className="relative flex-1 h-6 flex items-center">
                            <input 
                              type="range" min="1" max="3" step="0.1" 
                              value={zoom}
                              onChange={(e) => setZoom(Number(e.target.value))}
                              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                            />
                            <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                               <div className="h-full bg-yellow-500" style={{ width: `${((zoom - 1) / 2) * 100}%` }} />
                            </div>
                            <div className="absolute w-4 h-4 bg-white rounded-full shadow-md pointer-events-none transition-all flex items-center justify-center" style={{ left: `calc(${ ((zoom - 1) / 2) * 100 }% - 8px)` }}>
                                <div className="w-1.5 h-1.5 rounded-full bg-yellow-500" />
                            </div>
                        </div>
                        <ZoomIn size={14} className="text-white/30 ml-2" />
                     </div>
                  </div>

                  {/* Sliders Grid */}
                  <div className="flex flex-col gap-6 mb-8">
                    {[
                      { label: 'Brightness', val: bBrightness, set: setBBrightness, icon: Sun },
                      { label: 'Contrast', val: bContrast, set: setBContrast, icon: Contrast },
                      { label: 'Warmth', val: bWarmth, set: setBWarmth, icon: Zap },
                      { label: 'Saturation', val: bSaturation, set: setBSaturation, icon: Droplet },
                    ].map((ctrl) => (
                      <div key={ctrl.label} className="flex flex-col gap-2">
                         <div className="flex justify-between items-end">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-white/60 flex items-center gap-2">
                               <ctrl.icon size={10} className="text-yellow-500" /> {ctrl.label}
                            </span>
                            <span className="text-[10px] font-mono text-yellow-500">{ctrl.val}%</span>
                         </div>
                         <div className="h-6 w-full relative flex items-center">
                            <input 
                              type="range" min="0" max="200" 
                              value={ctrl.val}
                              onChange={(e) => ctrl.set(Number(e.target.value))}
                              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                            />
                            <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                               <div className="h-full bg-gradient-to-r from-yellow-600 to-yellow-400" style={{ width: `${(ctrl.val / 200) * 100}%` }} />
                            </div>
                            <div className="absolute w-4 h-4 bg-white rounded-full shadow-md pointer-events-none transition-all" style={{ left: `calc(${ (ctrl.val / 200) * 100 }% - 8px)` }} />
                         </div>
                      </div>
                    ))}
                  </div>

                  {/* Presets Row */}
                  <div className="grid grid-cols-2 gap-2">
                     {[
                       { name: 'Studio', s: { b: 110, c: 105, w: 10, sa: 100 } },
                       { name: 'Natural', s: { b: 100, c: 100, w: 0, sa: 100 } },
                       { name: 'Golden Hour', s: { b: 110, c: 110, w: 50, sa: 120 } },
                       { name: 'Night', s: { b: 140, c: 120, w: 0, sa: 90 } },
                     ].map(p => (
                       <button
                          key={p.name}
                          onClick={() => {
                            setBBrightness(p.s.b); setBContrast(p.s.c); setBWarmth(p.s.w); setBSaturation(p.s.sa);
                          }}
                          className="py-3 rounded-xl bg-white/5 border border-white/5 text-[10px] font-bold text-white/80 uppercase tracking-wider hover:bg-yellow-500/20 hover:text-yellow-400 hover:border-yellow-500/30 transition-all"
                       >
                         {p.name}
                       </button>
                     ))}
                  </div>
              </div>
            </div>
          </>
        )}

        {/* ==========================================================
            TAB: GALLERY (Full Width)
           ========================================================== */}
        {activeTab === 'gallery' && (
          <div className="w-full max-w-4xl px-4 flex flex-col h-full animate-fade-in">
            <h2 className="text-white text-3xl font-playfair font-bold mb-8 pl-4 drop-shadow-md border-l-4 border-yellow-500">My Studio</h2>
            {galleryItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-32 text-white/30 border-2 border-dashed border-white/10 rounded-[3rem] bg-white/5">
                <ImageIcon size={64} className="mb-6 opacity-50" strokeWidth={1} />
                <p className="text-sm font-medium uppercase tracking-widest mb-6">Gallery Empty</p>
                <button onClick={() => setActiveTab('camera')} className="px-8 py-3 bg-white text-black rounded-full text-xs font-bold uppercase tracking-widest hover:scale-105 transition-transform">Start Creating</button>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 pb-32">
                {galleryItems.map((item, index) => (
                  <button 
                    key={index} 
                    onClick={() => setCapturedItem(item)}
                    className="relative aspect-square rounded-3xl overflow-hidden group bg-zinc-900 border border-white/5 hover:border-yellow-500/50 transition-all hover:shadow-2xl hover:-translate-y-1"
                  >
                    {item.type === 'video' ? (
                      <video src={item.url} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                    ) : (
                      <img src={item.url} alt={`Captured ${index}`} className="w-full h-full object-cover" />
                    )}
                    
                    {item.type === 'video' && (
                       <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <div className="w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center">
                             <Play size={16} className="text-white fill-white ml-1" />
                          </div>
                       </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ==========================================================
            TAB: SETTINGS (Centered)
           ========================================================== */}
        {activeTab === 'settings' && (
           <div className="w-full max-w-md px-4 flex flex-col h-full animate-fade-in text-white">
            <h2 className="text-white text-3xl font-playfair font-bold mb-8 pl-4 drop-shadow-md">Preferences</h2>
            <div className="flex flex-col gap-4">
              <div className="bg-zinc-900/60 backdrop-blur-xl rounded-[2rem] border border-white/10 p-6 flex justify-between items-center shadow-lg">
                 <div className="flex items-center gap-4">
                   <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-white">
                     <RefreshCw size={22} />
                   </div>
                   <div className="flex flex-col">
                      <span className="text-sm font-bold tracking-wide">Mirror Camera</span>
                      <span className="text-[10px] text-white/50 uppercase tracking-wider">Flip front-facing video</span>
                   </div>
                 </div>
                 <button 
                  onClick={() => setMirrorMode(!mirrorMode)}
                  className={`w-14 h-8 rounded-full transition-all duration-300 relative shadow-inner ${mirrorMode ? 'bg-white' : 'bg-zinc-800'}`}
                 >
                   <div className={`absolute top-1 w-6 h-6 rounded-full shadow-md transition-all duration-300 ${mirrorMode ? 'left-7 bg-black' : 'left-1 bg-white/50'}`} />
                 </button>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* --- NAVIGATION BAR --- */}
      <div className="fixed bottom-16 lg:bottom-8 left-0 w-full z-[45] px-4 pointer-events-none">
        <div className="pointer-events-auto w-full max-w-[380px] mx-auto bg-black/80 backdrop-blur-2xl border border-white/10 rounded-full shadow-[0_10px_40px_rgba(0,0,0,0.5)] flex justify-between items-center p-1.5 px-2">
            {[
              { id: 'camera', icon: Camera, label: 'Capture' },
              { id: 'banna', icon: Zap, label: 'Banna FX' },
              { id: 'gallery', icon: ImageIcon, label: 'Studio' },
              { id: 'settings', icon: Settings, label: 'Config' },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as any)}
                className={`flex-1 flex flex-col items-center justify-center py-3 rounded-full transition-all duration-500 group relative
                  ${activeTab === item.id 
                    ? (item.id === 'banna' ? 'bg-gradient-to-br from-yellow-500 to-amber-600 text-black shadow-lg shadow-yellow-500/20' : 'bg-white text-black shadow-lg') 
                    : 'text-white/40 hover:text-white hover:bg-white/5'}`}
              >
                <item.icon size={20} strokeWidth={activeTab === item.id ? 2.5 : 1.5} className="group-hover:scale-110 transition-transform" />
                {activeTab === item.id && (
                  <span className="text-[8px] font-black mt-1 uppercase tracking-widest animate-fade-in whitespace-nowrap">{item.label}</span>
                )}
              </button>
            ))}
        </div>
      </div>

      {/* --- PREMIUM BRAND FOOTER --- */}
      <div className="fixed bottom-0 left-0 w-full z-50 bg-gradient-to-t from-black via-black/90 to-transparent pt-6 pb-4 pointer-events-none">
        <div className="w-full flex justify-center items-center gap-2">
           <Heart size={10} className="text-yellow-500 fill-yellow-500 animate-pulse" />
           <p className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-200 via-yellow-400 to-yellow-200 text-center text-[10px] font-medium tracking-[0.2em] font-playfair italic drop-shadow-[0_2px_10px_rgba(255,215,0,0.3)]">
             Made by Banna especially for my Anna
          </p>
           <Heart size={10} className="text-yellow-500 fill-yellow-500 animate-pulse" />
        </div>
      </div>

      {/* Hidden Canvas */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Capture Result Modal */}
      <Modal isOpen={!!capturedItem && activeTab !== 'gallery'} onClose={() => setCapturedItem(null)}>
         <div className="flex flex-col gap-5">
            <h2 className="text-white text-center font-playfair text-2xl font-bold tracking-wide text-yellow-500">Captured Moment</h2>
            <div className="bg-black rounded-2xl overflow-hidden aspect-square border border-white/10 shadow-2xl relative">
               {capturedItem && capturedItem.type === 'video' ? (
                  <video src={capturedItem.url} controls autoPlay className="w-full h-full object-cover" />
               ) : (
                  capturedItem && <img src={capturedItem.url} alt="Preview" className="w-full h-full object-cover" />
               )}
            </div>
            <div className="grid grid-cols-2 gap-3 mt-1">
              <button 
                onClick={() => setCapturedItem(null)}
                className="py-4 rounded-2xl bg-zinc-800 text-white font-bold text-xs uppercase tracking-widest hover:bg-zinc-700 transition-colors"
              >
                Discard
              </button>
              <button 
                onClick={() => capturedItem && handleDownload(capturedItem)}
                className="py-4 rounded-2xl bg-gradient-to-r from-yellow-500 to-amber-500 text-black font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:scale-105 transition-transform shadow-lg"
              >
                <Download size={16} /> Save
              </button>
            </div>
         </div>
      </Modal>

      {/* Fullscreen Gallery View */}
      <Modal isOpen={!!capturedItem && activeTab === 'gallery'} onClose={() => setCapturedItem(null)}>
         <div className="flex flex-col gap-4">
            <div className="bg-black rounded-[2rem] overflow-hidden aspect-square border border-white/10 relative shadow-2xl">
               {capturedItem && capturedItem.type === 'video' ? (
                  <video src={capturedItem.url} controls className="w-full h-full object-cover" />
               ) : (
                  capturedItem && <img src={capturedItem.url} alt="Gallery View" className="w-full h-full object-cover" />
               )}
            </div>
            <div className="flex flex-col gap-3">
               <button 
                onClick={() => capturedItem && handleDownload(capturedItem)}
                className="w-full py-4 rounded-2xl bg-white text-black font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg"
              >
                <Download size={16} /> Download
              </button>
              <button 
                onClick={() => {
                   const idx = galleryItems.findIndex(p => p === capturedItem);
                   if (idx >= 0) handleDelete(idx);
                   setCapturedItem(null);
                }}
                className="w-full py-4 rounded-2xl bg-red-500/10 text-red-500 border border-red-500/20 font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-red-500/20 transition-colors"
              >
                <Trash2 size={16} /> Delete
              </button>
            </div>
         </div>
      </Modal>

      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        @keyframes scale-up {
          from { opacity: 0; transform: scale(0.9) translateY(20px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        .animate-scale-up { animation: scale-up 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        .animate-fade-in { animation: fade-in 0.3s ease-out; }
        @keyframes pulse-slow {
          0%, 100% { opacity: 0.3; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.1); }
        }
        .animate-pulse-slow { animation: pulse-slow 8s ease-in-out infinite; }
      `}</style>

    </div>
  );
};

export default App;