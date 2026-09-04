import { queryDatabase } from "../utils/database";
import { ISpatialValidationResult, IGeometryInput } from "../types";

class SpatialService {
  async validateAndCheckOverlap(
    geometry: IGeometryInput,
    excludeParcelId?: string
  ): Promise<ISpatialValidationResult> {
    const result: ISpatialValidationResult = {
      isValid: false,
      topologyValid: false,
      areaInSqMeters: 0,
      intersectingParcels: [],
      errors: [],
    };

    try {
      const wkt = this.geojsonToWkt(geometry);

      const topologyCheck = await queryDatabase(
        `SELECT ST_IsValid(ST_SetSRID(ST_GeomFromText($1), 4326)) as is_valid,
                ST_IsValidReason(ST_SetSRID(ST_GeomFromText($1), 4326)) as reason`,
        [wkt]
      );

      result.topologyValid = Boolean(topologyCheck.rows[0].is_valid);

      if (!result.topologyValid) {
        result.errors.push(`Topology error: ${topologyCheck.rows[0].reason}`);
        return result;
      }

      const areaCheck = await queryDatabase(
        `SELECT ST_Area(ST_SetSRID(ST_GeomFromText($1), 4326)::geography) as area_sq_meters`,
        [wkt]
      );

      result.areaInSqMeters = parseFloat(areaCheck.rows[0].area_sq_meters);

      let intersectionQuery = `
        SELECT id, ulpin FROM land_parcels
        WHERE ST_Intersects(geometry, ST_SetSRID(ST_GeomFromText($1), 4326))
          AND NOT ST_Touches(geometry, ST_SetSRID(ST_GeomFromText($1), 4326))
      `;
      const queryParams: string[] = [wkt];

      if (excludeParcelId) {
        intersectionQuery += ` AND id != $2`;
        queryParams.push(excludeParcelId);
      }

      const intersectionCheck = await queryDatabase(
        intersectionQuery,
        queryParams
      );

      result.intersectingParcels = intersectionCheck.rows.map(
        (row: { id: string }) => row.id
      );

      if (result.intersectingParcels.length > 0) {
        result.errors.push(
          `Land overlap detected with parcels: ${result.intersectingParcels.join(", ")}`
        );
        result.isValid = false;
      } else {
        result.isValid = true;
      }

      return result;
    } catch (error) {
      console.error("Spatial validation error:", error);
      result.errors.push("Spatial validation failed");
      return result;
    }
  }

  async findParcelsInBbox(
    minX: number,
    minY: number,
    maxX: number,
    maxY: number,
    limit = 100
  ): Promise<unknown[]> {
    const bbox = `POLYGON((${minX} ${minY}, ${maxX} ${minY}, ${maxX} ${maxY}, ${minX} ${maxY}, ${minX} ${minY}))`;

    const result = await queryDatabase(
      `SELECT id, ulpin, owner_id,
              ST_AsGeoJSON(geometry) as geometry,
              area_in_sq_meters,
              location
       FROM land_parcels
       WHERE ST_Intersects(geometry, ST_SetSRID(ST_GeomFromText($1), 4326))
       LIMIT $2`,
      [bbox, limit]
    );

    return result.rows;
  }

  async findNearestParcels(
    longitude: number,
    latitude: number,
    radiusMeters = 1000,
    limit = 10
  ): Promise<unknown[]> {
    const result = await queryDatabase(
      `SELECT id, ulpin, owner_id,
              ST_AsGeoJSON(geometry) as geometry,
              area_in_sq_meters,
              ST_Distance(geometry::geography, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) as distance
       FROM land_parcels
       WHERE ST_DWithin(
         geometry::geography,
         ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
         $3
       )
       ORDER BY distance
       LIMIT $4`,
      [longitude, latitude, radiusMeters, limit]
    );

    return result.rows;
  }

  async calculateIntersectionArea(
    parcelId1: string,
    parcelId2: string
  ): Promise<number> {
    try {
      const result = await queryDatabase(
        `SELECT ST_Area(ST_Intersection(
          (SELECT geometry FROM land_parcels WHERE id = $1),
          (SELECT geometry FROM land_parcels WHERE id = $2)
        )::geography) as intersection_area`,
        [parcelId1, parcelId2]
      );
      return parseFloat(result.rows[0].intersection_area) || 0;
    } catch (error) {
      console.error("Calculate intersection area error:", error);
      return 0;
    }
  }

  async getAllParcelsGeoJSON(limit = 1000): Promise<Record<string, unknown>> {
    const result = await queryDatabase(
      `SELECT jsonb_build_object(
          'type', 'FeatureCollection',
          'features', COALESCE(jsonb_agg(jsonb_build_object(
            'type', 'Feature',
            'id', id,
            'properties', jsonb_build_object(
              'ulpin', ulpin,
              'owner_id', owner_id,
              'area_sq_meters', area_in_sq_meters,
              'location', location,
              'document_ipfs_cid', document_ipfs_cid,
              'created_at', created_at
            ),
            'geometry', ST_AsGeoJSON(geometry)::jsonb
          )), '[]'::jsonb)
        ) as geojson
        FROM (SELECT * FROM land_parcels ORDER BY created_at DESC LIMIT $1) as parcels`,
      [limit]
    );

    return result.rows[0].geojson;
  }

  async getParcelGeoJSON(parcelId: string): Promise<Record<string, unknown> | null> {
    const result = await queryDatabase(
      `SELECT jsonb_build_object(
          'type', 'Feature',
          'id', id,
          'properties', jsonb_build_object(
            'ulpin', ulpin,
            'owner_id', owner_id,
            'area_sq_meters', area_in_sq_meters,
            'location', location,
            'document_ipfs_cid', document_ipfs_cid,
            'blockchain_hash', blockchain_hash,
            'created_at', created_at
          ),
          'geometry', ST_AsGeoJSON(geometry)::jsonb
        ) as geojson
        FROM land_parcels
        WHERE id = $1`,
      [parcelId]
    );

    return result.rows[0]?.geojson || null;
  }

  private geojsonToWkt(geometry: IGeometryInput): string {
    if (geometry.type !== "Polygon") {
      throw new Error("Only Polygon geometry is supported");
    }

    const ring = geometry.coordinates[0];
    if (!ring || ring.length < 4) {
      throw new Error("Polygon must have at least 4 positions (closed ring)");
    }

    const first = ring[0];
    const last = ring[ring.length - 1];
    const closed =
      first[0] === last[0] && first[1] === last[1]
        ? ring
        : [...ring, first];

    const coordinates = closed
      .map((coord: number[]) => `${coord[0]} ${coord[1]}`)
      .join(", ");

    return `POLYGON((${coordinates}))`;
  }

  async createSpatialIndex(): Promise<void> {
    await queryDatabase(
      `CREATE INDEX IF NOT EXISTS idx_land_parcels_geometry
       ON land_parcels USING GIST (geometry)`
    );
  }
}

export const spatialService = new SpatialService();
