import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Route, Search, Plane, FileText } from "lucide-react";

type RouteRow = Database["public"]["Tables"]["routes"]["Row"];
type AircraftRow = Database["public"]["Tables"]["aircraft"]["Row"];

const rankLabels: Record<string, string> = {
  cadet: "Cadet",
  first_officer: "First Officer",
  captain: "Captain",
  senior_captain: "Senior Captain",
  commander: "Commander",
};

export default function RoutesPage() {
  const navigate = useNavigate();
  const [depFilter, setDepFilter] = useState("");
  const [arrFilter, setArrFilter] = useState("");
  const [aircraftFilter, setAircraftFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const { data: routes, isLoading } = useQuery({
    queryKey: ["routes"],
    queryFn: async () => {
      const pageSize = 1000;
      const { count, error: countError } = await supabase
        .from("routes")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true);

      if (countError) throw countError;
      if (!count || count === 0) return [];

      const allRoutes: RouteRow[] = [];
      for (let from = 0; from < count; from += pageSize) {
        const to = Math.min(from + pageSize - 1, count - 1);
        const { data, error } = await supabase
          .from("routes")
          .select("*")
          .eq("is_active", true)
          .order("route_number")
          .range(from, to);

        if (error) throw error;
        allRoutes.push(...(data || []));
      }

      return allRoutes;
    },
  });

  const { data: aircraft } = useQuery({
    queryKey: ["aircraft"],
    queryFn: async () => {
      const { data } = await supabase.from("aircraft").select("*").order("icao_code").order("name");
      return data || [];
    },
  });

  const selectedAircraftFilter = useMemo<AircraftRow | null>(() => {
    if (aircraftFilter === "all") return null;
    return aircraft?.find((ac) => ac.id === aircraftFilter) || null;
  }, [aircraft, aircraftFilter]);

  const filteredRoutes = routes?.filter((route) => {
    const matchesDep = depFilter === "" || route.dep_icao.includes(depFilter.toUpperCase());
    const matchesArr = arrFilter === "" || route.arr_icao.includes(arrFilter.toUpperCase());
    const matchesAircraft =
      !selectedAircraftFilter ||
      (route.aircraft_icao === selectedAircraftFilter.icao_code &&
        (route.livery || "") === (selectedAircraftFilter.livery || ""));
    const matchesType = typeFilter === "all" || route.route_type === typeFilter;
    return matchesDep && matchesArr && matchesAircraft && matchesType;
  });

  const formatFlightTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}:${mins.toString().padStart(2, "0")}`;
  };

  const handleFilePirep = (route: RouteRow) => {
    const params = new URLSearchParams({
      dep: route.dep_icao,
      arr: route.arr_icao,
      aircraft: route.aircraft_icao || "",
      flight: route.route_number,
      type: route.route_type,
    });

    if (route.livery) {
      params.set("livery", route.livery);
    }

    navigate(`/file-pirep?${params.toString()}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Route className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Route Database</h1>
          <p className="text-muted-foreground">Browse available routes and file PIREPs</p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-4 md:grid-cols-5">
            <div className="space-y-2">
              <label className="text-sm font-medium">Departure</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="ICAO"
                  value={depFilter}
                  onChange={(e) => setDepFilter(e.target.value)}
                  className="pl-9"
                  maxLength={4}
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Arrival</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="ICAO"
                  value={arrFilter}
                  onChange={(e) => setArrFilter(e.target.value)}
                  className="pl-9"
                  maxLength={4}
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Aircraft</label>
              <Select value={aircraftFilter} onValueChange={setAircraftFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Aircraft</SelectItem>
                  {aircraft?.map((ac) => (
                    <SelectItem key={ac.id} value={ac.id}>
                      {ac.name}{ac.livery ? ` (${ac.livery})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Type</label>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="passenger">Passenger</SelectItem>
                  <SelectItem value="cargo">Cargo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button
                variant="outline"
                onClick={() => {
                  setDepFilter("");
                  setArrFilter("");
                  setAircraftFilter("all");
                  setTypeFilter("all");
                }}
              >
                Clear Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Routes Table */}
      <Card>
        <CardHeader>
          <CardTitle>Available Routes</CardTitle>
          <CardDescription>
            {filteredRoutes?.length || 0} routes found
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : filteredRoutes && filteredRoutes.length > 0 ? (
            <div className="relative overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-2 font-medium">Route</th>
                    <th className="text-left py-3 px-2 font-medium">Departure</th>
                    <th className="text-left py-3 px-2 font-medium">Arrival</th>
                    <th className="text-left py-3 px-2 font-medium">Aircraft</th>
                    <th className="text-left py-3 px-2 font-medium">Type</th>
                    <th className="text-left py-3 px-2 font-medium">Est. Time</th>
                    <th className="text-left py-3 px-2 font-medium">Min Rank</th>
                    <th className="text-left py-3 px-2 font-medium">Notes</th>
                    <th className="text-right py-3 px-2 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRoutes.map((route) => (
                    <tr key={route.id} className="border-b last:border-0 hover:bg-muted/50">
                      <td className="py-3 px-2 font-medium">{route.route_number}</td>
                      <td className="py-3 px-2 font-mono">{route.dep_icao}</td>
                      <td className="py-3 px-2 font-mono">{route.arr_icao}</td>
                      <td className="py-3 px-2">
                        <div className="flex flex-col">
                          <div className="flex items-center gap-1">
                            <Plane className="h-3 w-3 text-muted-foreground" />
                            {route.aircraft_icao}
                          </div>
                          {route.livery && (
                            <span className="text-xs text-muted-foreground">{route.livery}</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-2">
                        <Badge variant="secondary" className="capitalize">
                          {route.route_type}
                        </Badge>
                      </td>
                      <td className="py-3 px-2">{formatFlightTime(route.est_flight_time_minutes)}</td>
                      <td className="py-3 px-2">
                        <Badge variant="outline" className="capitalize">
                          {rankLabels[route.min_rank] || route.min_rank}
                        </Badge>
                      </td>
                      <td className="py-3 px-2 text-muted-foreground max-w-[200px] truncate">
                        {route.notes || "-"}
                      </td>
                      <td className="py-3 px-2 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleFilePirep(route)}
                        >
                          <FileText className="h-3 w-3 mr-1" />
                          File PIREP
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Route className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No routes found</p>
              <p className="text-sm">Try adjusting your filters or check back later</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
