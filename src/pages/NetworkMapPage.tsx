import React, { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { supabase, Host, Port } from '../lib/supabase';
import {
  Network,
  Server,
  Loader2,
  RefreshCw,
  ZoomIn,
  ZoomOut,
  Move,
} from 'lucide-react';
import clsx from 'clsx';

type Node = {
  id: string;
  ip: string;
  hostname: string;
  os: string;
  ports: Port[];
  x: number;
  y: number;
  vx: number;
  vy: number;
};

export default function NetworkMapPage() {
  const [hosts, setHosts] = useState<Host[]>([]);
  const [loading, setLoading] = useState(true);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [lastMouse, setLastMouse] = useState({ x: 0, y: 0 });

  useEffect(() => {
    fetchHosts();
  }, []);

  useEffect(() => {
    if (hosts.length > 0) {
      initializeNodes();
    }
  }, [hosts]);

  const fetchHosts = async () => {
    try {
      const { data: hostData } = await supabase
        .from('hosts')
        .select('*')
        .limit(100);

      setHosts(hostData || []);

      // Fetch ports for each host
      if (hostData) {
        const portsMap: Record<string, Port[]> = {};
        for (const host of hostData) {
          const { data } = await supabase
            .from('ports')
            .select('*')
            .eq('host_id', host.id);
          portsMap[host.id] = data || [];
        }
      }
    } catch (error) {
      console.error('Error fetching hosts:', error);
    } finally {
      setLoading(false);
    }
  };

  const initializeNodes = () => {
    const width = 800;
    const height = 600;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) / 3;

    const newNodes: Node[] = hosts.map((host, index) => {
      const angle = (2 * Math.PI * index) / hosts.length;
      const x = centerX + radius * Math.cos(angle);
      const y = centerY + radius * Math.sin(angle);
      return {
        id: host.id,
        ip: host.ip_address,
        hostname: host.hostname || 'Unknown',
        os: host.os_name || 'Unknown OS',
        ports: [],
        x,
        y,
        vx: 0,
        vy: 0,
      };
    });

    setNodes(newNodes);
  };

  const severityColor = (host: Host) => {
    // Simple heuristic based on open ports
    return 'border-primary-500 bg-primary-500/20';
  };

  const drawNetwork = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);

    // Draw center node (network/gateway)
    ctx.beginPath();
    ctx.arc(width / 2, height / 2, 40, 0, 2 * Math.PI);
    ctx.fillStyle = '#1e40af';
    ctx.fill();
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#fff';
    ctx.font = '12px Inter';
    ctx.textAlign = 'center';
    ctx.fillText('Network', width / 2, height / 2 + 4);

    // Draw connections and nodes
    nodes.forEach((node, index) => {
      // Draw connection line
      ctx.beginPath();
      ctx.moveTo(width / 2, height / 2);
      ctx.lineTo(node.x, node.y);
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Draw node
      const isSelected = selectedNode?.id === node.id;
      ctx.beginPath();
      ctx.arc(node.x, node.y, isSelected ? 25 : 20, 0, 2 * Math.PI);

      ctx.fillStyle = isSelected ? '#1e40af' : '#1e293b';
      ctx.fill();
      ctx.strokeStyle = isSelected ? '#3b82f6' : '#3b82f6';
      ctx.lineWidth = isSelected ? 3 : 2;
      ctx.stroke();

      // Draw IP label
      ctx.fillStyle = '#e2e8f0';
      ctx.font = '10px JetBrains Mono';
      ctx.textAlign = 'center';
      ctx.fillText(node.ip, node.x, node.y + 35);
    });

    ctx.restore();
  };

  useEffect(() => {
    if (nodes.length > 0) {
      drawNetwork();
    }
  }, [nodes, zoom, pan, selectedNode]);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left - pan.x) / zoom;
    const y = (e.clientY - rect.top - pan.y) / zoom;

    if (dragging) {
      setPan({
        x: e.clientX - lastMouse.x,
        y: e.clientY - lastMouse.y,
      });
      return;
    }

    // Check if mouse is over a node
    const hoveredNode = nodes.find(node => {
      const dist = Math.sqrt((node.x - x) ** 2 + (node.y - y) ** 2);
      return dist < 20;
    });

    canvas.style.cursor = hoveredNode ? 'pointer' : 'default';
  };

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left - pan.x) / zoom;
    const y = (e.clientY - rect.top - pan.y) / zoom;

    const clickedNode = nodes.find(node => {
      const dist = Math.sqrt((node.x - x) ** 2 + (node.y - y) ** 2);
      return dist < 25;
    });

    setSelectedNode(clickedNode || null);
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
      setDragging(true);
      setLastMouse({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseUp = () => {
    setDragging(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Network Map</h1>
          <p className="text-dark-400 mt-1">Visualize discovered hosts and their connections</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setZoom(z => Math.min(3, z + 0.2))} className="btn btn-secondary p-2">
            <ZoomIn className="w-4 h-4" />
          </button>
          <button onClick={() => setZoom(z => Math.max(0.5, z - 0.2))} className="btn btn-secondary p-2">
            <ZoomOut className="w-4 h-4" />
          </button>
          <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} className="btn btn-secondary p-2">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3 card overflow-hidden">
          <canvas
            ref={canvasRef}
            width={800}
            height={600}
            className="w-full h-[600px]"
            onMouseMove={handleMouseMove}
            onClick={handleClick}
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          />
        </div>

        {/* Selected Node Details */}
        <div className="card p-6">
          {selectedNode ? (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white">Host Details</h3>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-dark-400 uppercase tracking-wider">IP Address</p>
                  <p className="text-white font-mono mt-1">{selectedNode.ip}</p>
                </div>
                <div>
                  <p className="text-xs text-dark-400 uppercase tracking-wider">Hostname</p>
                  <p className="text-white mt-1">{selectedNode.hostname}</p>
                </div>
                <div>
                  <p className="text-xs text-dark-400 uppercase tracking-wider">Operating System</p>
                  <p className="text-white mt-1">{selectedNode.os}</p>
                </div>
                <div>
                  <p className="text-xs text-dark-400 uppercase tracking-wider">Open Ports</p>
                  <div className="mt-2 space-y-1">
                    {selectedNode.ports.filter(p => p.state === 'open').slice(0, 5).map(port => (
                      <div key={port.id} className="flex items-center justify-between text-sm">
                        <span className="font-mono text-dark-300">{port.port_number}/{port.protocol}</span>
                        <span className="text-dark-400">{port.service_name || 'Unknown'}</span>
                      </div>
                    ))}
                    {selectedNode.ports.filter(p => p.state === 'open').length === 0 && (
                      <p className="text-dark-400 text-sm">No open ports</p>
                    )}
                  </div>
                </div>
              </div>
              <Link
                to={`/scans`}
                className="btn btn-primary w-full mt-4"
              >
                View in Scans
              </Link>
            </div>
          ) : (
            <div className="text-center py-8">
              <Server className="w-10 h-10 text-dark-600 mx-auto mb-3" />
              <p className="text-dark-400 text-sm">
                Click on a host to view details
              </p>
              <p className="text-dark-500 text-xs mt-2">
                Shift + drag to pan, scroll to zoom
              </p>
            </div>
          )}
        </div>
      </div>

      {hosts.length === 0 && (
        <div className="card p-12 text-center">
          <Network className="w-12 h-12 text-dark-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">No hosts discovered</h3>
          <p className="text-dark-400 mb-6">
            Run a scan to discover hosts on your network
          </p>
          <Link to="/scans/new" className="btn btn-primary">
            Run New Scan
          </Link>
        </div>
      )}
    </div>
  );
}
