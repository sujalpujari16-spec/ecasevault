import React, { useEffect, useRef } from 'react';

interface BasReliefEmblemProps {
  className?: string;
  size?: number;
  opacity?: number;
}

export const BasReliefEmblem: React.FC<BasReliefEmblemProps> = ({
  className = '',
  size = 480,
  opacity = 0.25,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      const dpr = window.devicePixelRatio || 2;
      const targetSize = size;
      canvas.width = targetSize * dpr;
      canvas.height = targetSize * dpr;
      canvas.style.width = `${targetSize}px`;
      canvas.style.height = `${targetSize}px`;

      ctx.save();
      ctx.scale((targetSize / 500) * dpr, (targetSize / 500) * dpr);
      ctx.clearRect(0, 0, 500, 500);

      const cx = 250;
      const cy = 250;
      const stoneStroke = '#7a7364';
      const stoneFill = 'rgba(215, 209, 196, 0.25)';

      // 1. Outer Concentric Stone Ring Carving
      ctx.beginPath();
      ctx.arc(cx, cy, 240, 0, Math.PI * 2);
      ctx.fillStyle = stoneFill;
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.strokeStyle = stoneStroke;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(cx, cy, 232, 0, Math.PI * 2);
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 6]);
      ctx.strokeStyle = '#9c9586';
      ctx.stroke();
      ctx.setLineDash([]);

      // 2. 5-Pointed Star
      const starOuterR = 175;
      const starInnerR = 72;
      const starCenterY = 240;

      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const outerAngle = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
        const ox = cx + starOuterR * Math.cos(outerAngle);
        const oy = starCenterY + starOuterR * Math.sin(outerAngle);
        if (i === 0) ctx.moveTo(ox, oy);
        else ctx.lineTo(ox, oy);

        const innerAngle = outerAngle + Math.PI / 5;
        const ix = cx + starInnerR * Math.cos(innerAngle);
        const iy = starCenterY + starInnerR * Math.sin(innerAngle);
        ctx.lineTo(ix, iy);
      }
      ctx.closePath();
      ctx.fillStyle = 'rgba(205, 199, 186, 0.35)';
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.strokeStyle = stoneStroke;
      ctx.lineJoin = 'round';
      ctx.stroke();

      // Inner double star line
      const insetOuterR = 145;
      const insetInnerR = 60;
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const outerAngle = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
        const ox = cx + insetOuterR * Math.cos(outerAngle);
        const oy = starCenterY + insetOuterR * Math.sin(outerAngle);
        if (i === 0) ctx.moveTo(ox, oy);
        else ctx.lineTo(ox, oy);

        const innerAngle = outerAngle + Math.PI / 5;
        const ix = cx + insetInnerR * Math.cos(innerAngle);
        const iy = starCenterY + insetInnerR * Math.sin(innerAngle);
        ctx.lineTo(ix, iy);
      }
      ctx.closePath();
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#968f80';
      ctx.stroke();

      // Crease lines
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const outerAngle = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
        ctx.moveTo(cx + starOuterR * Math.cos(outerAngle), starCenterY + starOuterR * Math.sin(outerAngle));
        ctx.lineTo(cx, starCenterY);
      }
      ctx.lineWidth = 1.8;
      ctx.strokeStyle = 'rgba(132, 125, 110, 0.4)';
      ctx.stroke();

      // 3. Central Disc
      ctx.beginPath();
      ctx.arc(cx, starCenterY, 56, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(225, 219, 206, 0.45)';
      ctx.fill();
      ctx.lineWidth = 4.5;
      ctx.strokeStyle = stoneStroke;
      ctx.stroke();

      // 4. Abhaya Mudra Hand Carving
      ctx.save();
      ctx.fillStyle = stoneStroke;

      // Thumb
      ctx.beginPath();
      ctx.moveTo(222, 245);
      ctx.quadraticCurveTo(215, 235, 222, 222);
      ctx.quadraticCurveTo(228, 218, 232, 226);
      ctx.lineTo(233, 240);
      ctx.fill();

      // Four upright fingers
      ctx.beginPath();
      ctx.roundRect(235, 202, 6.5, 38, 3);
      ctx.fill();
      ctx.beginPath();
      ctx.roundRect(244, 194, 7, 46, 3);
      ctx.fill();
      ctx.beginPath();
      ctx.roundRect(253, 198, 6.8, 42, 3);
      ctx.fill();
      ctx.beginPath();
      ctx.roundRect(262, 208, 6, 32, 3);
      ctx.fill();

      // Palm base
      ctx.beginPath();
      ctx.moveTo(230, 240);
      ctx.lineTo(268, 240);
      ctx.quadraticCurveTo(270, 268, 258, 274);
      ctx.lineTo(240, 274);
      ctx.quadraticCurveTo(228, 268, 230, 240);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // 5. Bottom Ribbon
      ctx.save();
      ctx.fillStyle = 'rgba(215, 209, 196, 0.3)';
      ctx.strokeStyle = stoneStroke;
      ctx.lineWidth = 4;
      ctx.lineJoin = 'round';

      // Left scroll curl
      ctx.beginPath();
      ctx.moveTo(125, 385);
      ctx.bezierCurveTo(105, 365, 138, 350, 150, 368);
      ctx.bezierCurveTo(158, 380, 138, 395, 125, 385);
      ctx.fill();
      ctx.stroke();

      // Right scroll curl
      ctx.beginPath();
      ctx.moveTo(375, 385);
      ctx.bezierCurveTo(395, 365, 362, 350, 350, 368);
      ctx.bezierCurveTo(342, 380, 362, 395, 375, 385);
      ctx.fill();
      ctx.stroke();

      // Main Ribbon Body
      ctx.beginPath();
      ctx.moveTo(125, 370);
      ctx.quadraticCurveTo(250, 384, 375, 370);
      ctx.lineTo(380, 418);
      ctx.quadraticCurveTo(250, 434, 120, 418);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      // 6. DEVANAGARI TYPOGRAPHY
      const fontFamily = "'Noto Sans Devanagari', 'Mukta', 'Tiro Devanagari Marathi', sans-serif";

      const drawCurvedText = (
        textSegments: string[], 
        radius: number, 
        startAngleDeg: number, 
        endAngleDeg: number,
        fontSize: number
      ) => {
        ctx.save();
        ctx.font = `800 ${fontSize}px ${fontFamily}`;
        ctx.fillStyle = stoneStroke;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const totalSegments = textSegments.length;
        const startRad = (startAngleDeg * Math.PI) / 180;
        const endRad = (endAngleDeg * Math.PI) / 180;
        const angleStep = totalSegments > 1 ? (endRad - startRad) / (totalSegments - 1) : 0;

        textSegments.forEach((segment, idx) => {
          const angle = totalSegments > 1 ? startRad + idx * angleStep : (startRad + endRad) / 2;
          const x = cx + radius * Math.cos(angle);
          const y = cy + radius * Math.sin(angle);

          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(angle + Math.PI / 2);
          ctx.fillText(segment, 0, 0);
          ctx.restore();
        });
        ctx.restore();
      };

      // Top Left Arch: "महाराष्ट्र"
      drawCurvedText(['म', 'हा', 'रा', 'ष्ट्र'], 206, -145, -100, 32);

      // Top Right Arch: "पोलीस"
      drawCurvedText(['पो', 'ली', 'स'], 206, -80, -35, 32);

      // Bottom Banner Motto: "सद्रक्षणाय खलनिग्रहणाय"
      ctx.save();
      ctx.font = `800 18.5px ${fontFamily}`;
      ctx.fillStyle = stoneStroke;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('सद्रक्षणाय खलनिग्रहणाय', 250, 401);
      ctx.restore();

      ctx.restore();
    };

    if (document.fonts) {
      document.fonts.ready.then(draw);
    } else {
      draw();
    }
  }, [size, opacity]);

  return (
    <div 
      className={`relative pointer-events-none select-none rounded-full ${className}`}
      style={{ width: size, height: size, opacity }}
    >
      <canvas
        ref={canvasRef}
        className="w-full h-full block rounded-full"
        style={{ width: size, height: size }}
      />
    </div>
  );
};
