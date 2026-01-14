import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { ClientsService } from '../clients/clients.service';
import { GHLService } from './ghl.service';
import { formatearRut } from '../utils/rut.util';
import { formatearFechaEspanol, normalizarHora } from '../utils/date.util';
import { obtenerHoraActual, filtrarHorariosFuturos, validarBloquesConsecutivos } from '../utils/timezone.util';
import * as moment from 'moment-timezone';
import { SearchAvailabilityDto } from './dto/search-availability.dto';
import { SearchUserDto } from './dto/search-user.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { ScheduleAppointmentDto } from './dto/schedule-appointment.dto';
import { CancelAppointmentDto } from './dto/cancel-appointment.dto';
import { GetTreatmentsDto } from './dto/get-treatments.dto';

@Injectable()
export class DentalinkService {
  private readonly logger = new Logger(DentalinkService.name);

  constructor(
    private readonly clientsService: ClientsService,
    private readonly ghlService: GHLService,
  ) {}

  /**
   * Busca disponibilidad de profesionales en Dentalink
   */
  async searchAvailability(clientId: string, params: SearchAvailabilityDto): Promise<any> {
    this.logger.log('🔍 Iniciando búsqueda de disponibilidad');
    this.logger.log(`📋 Parámetros recibidos: ${JSON.stringify(params)}`);

    const client = await this.clientsService.findOne(clientId);
    const apiKey = client.apiKey;
    const timezone = client.timezone;
    const baseURL = process.env.DENTALINK_BASE_URL || 'https://api.dentalink.healthatom.com/api/v1/';

    // Validaciones
    if (!params.ids_profesionales || params.ids_profesionales.length === 0) {
      throw new HttpException('Se requiere al menos un ID de profesional', HttpStatus.BAD_REQUEST);
    }

    if (!params.id_sucursal) {
      throw new HttpException('Se requiere ID de sucursal', HttpStatus.BAD_REQUEST);
    }

    const headers = {
      Authorization: `Token ${apiKey}`,
      'Content-Type': 'application/json',
    };

    // Obtener información de profesionales
    const profesionalesInfo: { [key: number]: string } = {};
    const profesionalesIntervalos: { [key: number]: number } = {};

    try {
      this.logger.log('👨‍⚕️ Obteniendo información de profesionales...');
      const profResp = await axios.get(`${baseURL}dentistas`, { headers });
      if (profResp.status === 200) {
        const dentistas = profResp.data?.data || [];
        for (const dentista of dentistas) {
          if (params.ids_profesionales.includes(dentista.id)) {
            const apellido = dentista.apellido || dentista.apellidos || '';
            const nombreCompleto = `${dentista.nombre || 'Desconocido'} ${apellido}`.trim();
            const intervalo = dentista.intervalo;
            
            profesionalesInfo[dentista.id] = nombreCompleto;
            if (intervalo) {
              profesionalesIntervalos[dentista.id] = intervalo;
              this.logger.log(`✅ Profesional: ID ${dentista.id} - ${nombreCompleto} (Intervalo: ${intervalo} min)`);
            } else {
              this.logger.warn(`⚠️ Profesional ID ${dentista.id} sin intervalo configurado`);
            }
          }
        }
      }
    } catch (error) {
      this.logger.warn(`⚠️ Error obteniendo información de profesionales: ${error.message}`);
    }

    // Obtener hora actual en el timezone del cliente
    const horaActual = obtenerHoraActual(timezone);
    
    // Establecer fecha de inicio
    let fechaInicio: moment.Moment;
    if (params.fecha_inicio) {
      fechaInicio = moment.tz(params.fecha_inicio, timezone);
    } else {
      fechaInicio = horaActual.clone();
    }

    // Búsqueda iterativa hasta 4 semanas
    const intentosMaximos = 4;
    let intentoActual = 1;

    while (intentoActual <= intentosMaximos) {
      const fechaFin = fechaInicio.clone().add(6, 'days'); // 1 semana

      this.logger.log(
        `🔄 Intento ${intentoActual} de ${intentosMaximos}: Buscando del ${fechaInicio.format('YYYY-MM-DD')} al ${fechaFin.format('YYYY-MM-DD')}`,
      );

      // Preparar body JSON
      const bodyData = {
        ids_dentista: params.ids_profesionales,
        id_sucursal: params.id_sucursal,
        fecha_inicio: fechaInicio.format('YYYY-MM-DD'),
        fecha_fin: fechaFin.format('YYYY-MM-DD'),
      };

      this.logger.log(`📋 Body JSON enviado: ${JSON.stringify(bodyData)}`);

      // Intentar con diferentes URLs
      const urlsToTry = [`${baseURL}horariosdisponibles/`, `${baseURL}horariosdisponibles`];
      let response = null;
      let urlUsado = null;

      for (const url of urlsToTry) {
        try {
          this.logger.log(`🌐 Intentando URL: ${url}`);
          response = await axios.get(url, { headers, data: bodyData });
          this.logger.log(`📊 Status Code: ${response.status}`);

          if (response.status !== 404) {
            urlUsado = url;
            break;
          }
        } catch (error) {
          if (error.response?.status !== 404) {
            this.logger.error(`❌ Error al conectar con ${url}: ${error.message}`);
          }
        }
      }

      if (!response || response.status === 404) {
        throw new HttpException('Endpoint horariosdisponibles no encontrado', HttpStatus.NOT_FOUND);
      }

      this.logger.log(`✅ URL exitosa: ${urlUsado}`);

      if (response.status === 200) {
        const dataResponse = response.data;
        const horariosData = dataResponse?.data || {};

        if (Object.keys(horariosData).length > 0) {
          const disponibilidadFinal = [];

          for (const [idProfesionalStr, fechasHorarios] of Object.entries<any>(horariosData)) {
            const idProfesionalInt = parseInt(idProfesionalStr, 10);
            const nombreProfesional = profesionalesInfo[idProfesionalInt] || `Profesional ${idProfesionalInt}`;
            const intervaloProfesional = profesionalesIntervalos[idProfesionalInt];

            const disponibilidadProfesional: any = {
              id_profesional: idProfesionalInt,
              nombre_profesional: nombreProfesional,
              fechas: {},
            };

            if (typeof fechasHorarios === 'object') {
              for (const [fecha, horarios] of Object.entries<any>(fechasHorarios)) {
                if (Array.isArray(horarios)) {
                  let horariosFuturos = filtrarHorariosFuturos(horarios, fecha, horaActual);

                  if (horariosFuturos.length > 0) {
                    let horariosNormalizados = horariosFuturos.map((h) => normalizarHora(h.hora_inicio));

                    // Determinar tiempo de cita: usar el proporcionado o el intervalo del profesional
                    const tiempoCitaEfectivo = params.tiempo_cita || intervaloProfesional;

                    // Validar bloques consecutivos si tenemos tiempo de cita e intervalo
                    if (tiempoCitaEfectivo && intervaloProfesional) {
                      const usandoDefault = !params.tiempo_cita;
                      this.logger.log(
                        `🔍 Validando bloques consecutivos para tiempo_cita=${tiempoCitaEfectivo} min${usandoDefault ? ' (usando intervalo del profesional)' : ''}`,
                      );
                      horariosNormalizados = validarBloquesConsecutivos(
                        horariosNormalizados,
                        tiempoCitaEfectivo,
                        intervaloProfesional,
                      );
                    } else if (!intervaloProfesional) {
                      this.logger.warn(
                        `⚠️ El profesional ${nombreProfesional} no tiene intervalo configurado, se devuelven todos los horarios`,
                      );
                    }

                    if (horariosNormalizados.length > 0) {
                      const fechaFormateada = formatearFechaEspanol(fecha);
                      disponibilidadProfesional.fechas[fechaFormateada] = horariosNormalizados;
                      this.logger.log(`✅ Fecha ${fecha} agregada con ${horariosNormalizados.length} horarios`);
                    }
                  }
                }
              }
            }

            if (Object.keys(disponibilidadProfesional.fechas).length > 0) {
              disponibilidadFinal.push(disponibilidadProfesional);
            }
          }

          if (disponibilidadFinal.length > 0) {
            return {
              disponibilidad: disponibilidadFinal,
              fecha_desde: fechaInicio.format('YYYY-MM-DD'),
              fecha_hasta: fechaFin.format('YYYY-MM-DD'),
            };
          }
        }
      }

      // Avanzar a la siguiente semana
      fechaInicio.add(7, 'days');
      intentoActual++;
    }

    return {
      mensaje: 'No se encontró disponibilidad en las próximas 4 semanas',
      disponibilidad: [],
    };
  }

  /**
   * Busca un paciente por RUT en Dentalink
   */
  async searchUser(clientId: string, params: SearchUserDto): Promise<any> {
    this.logger.log(`🔍 Buscando paciente con RUT: ${params.rut}`);

    const client = await this.clientsService.findOne(clientId);
    const apiKey = client.apiKey;
    const baseURL = process.env.DENTALINK_BASE_URL || 'https://api.dentalink.healthatom.com/api/v1/';

    const rutFormateado = formatearRut(params.rut);
    const headers = {
      Authorization: `Token ${apiKey}`,
      'Content-Type': 'application/json',
    };

    try {
      const filtro = JSON.stringify({ rut: { eq: rutFormateado } });
      this.logger.log(`🔍 Buscando paciente: RUT=${rutFormateado}`);

      const response = await axios.get(`${baseURL}pacientes`, {
        headers,
        params: { q: filtro },
      });

      this.logger.log(`📊 Status búsqueda paciente: ${response.status}`);

      if (response.status === 200) {
        const pacientes = response.data?.data || [];
        if (pacientes.length > 0) {
          const paciente = pacientes[0];
          this.logger.log(`✅ Paciente encontrado con ID ${paciente.id}`);
          return {
            paciente,
          };
        }
      }
    } catch (error) {
      this.logger.warn(`⚠️ Error al buscar paciente: ${error.message}`);
    }

    throw new HttpException(
      `Paciente con RUT ${rutFormateado} no encontrado`,
      HttpStatus.NOT_FOUND,
    );
  }

  /**
   * Crea un nuevo paciente en Dentalink
   */
  async createUser(clientId: string, params: CreateUserDto): Promise<any> {
    this.logger.log(`👤 Creando paciente: ${params.nombre} ${params.apellidos}`);

    const client = await this.clientsService.findOne(clientId);
    const apiKey = client.apiKey;
    const baseURL = process.env.DENTALINK_BASE_URL || 'https://api.dentalink.healthatom.com/api/v1/';

    // Validaciones
    if (!params.nombre || !params.apellidos || !params.rut) {
      throw new HttpException(
        'Nombre, apellidos y RUT son requeridos',
        HttpStatus.BAD_REQUEST,
      );
    }

    const rutFormateado = formatearRut(params.rut);

    const headers = {
      Authorization: `Token ${apiKey}`,
      'Content-Type': 'application/json',
    };

    // Verificar si el paciente ya existe
    try {
      const pacienteExistente = await this.searchUser(clientId, { rut: rutFormateado });
      if (pacienteExistente.paciente) {
        return {
          id_paciente: pacienteExistente.paciente.id,
          mensaje: 'Paciente ya existe',
        };
      }
    } catch (error) {
      // Paciente no existe, continuar con la creación
    }

    // Crear nuevo paciente
    const payloadPaciente: any = {
      nombre: params.nombre,
      apellidos: params.apellidos,
      rut: rutFormateado,
      celular: params.telefono || '',
      email: params.email || '',
    };

    if (params.fecha_nacimiento) {
      payloadPaciente.fecha_nacimiento = params.fecha_nacimiento;
    }

    this.logger.log(`📤 Payload enviado a Dentalink: ${JSON.stringify(payloadPaciente)}`);

    try {
      const response = await axios.post(`${baseURL}pacientes/`, payloadPaciente, { headers });

      if (response.status === 201) {
        const pacienteData = response.data?.data || {};
        const idPaciente = pacienteData.id;
        this.logger.log(`✅ Paciente creado exitosamente con ID ${idPaciente}`);
        return {
          id_paciente: idPaciente,
          mensaje: 'Paciente creado exitosamente',
        };
      } else if (response.status === 400 && response.data?.message?.toLowerCase().includes('existe')) {
        // Paciente duplicado, intentar buscar nuevamente
        const pacienteExistente = await this.searchUser(clientId, { rut: rutFormateado });
        if (pacienteExistente.paciente) {
          return {
            id_paciente: pacienteExistente.paciente.id,
            mensaje: 'Paciente ya existía',
          };
        }
      }

      throw new HttpException(
        `Error al crear paciente: ${response.data}`,
        HttpStatus.BAD_REQUEST,
      );
    } catch (error) {
      this.logger.error(`❌ Error al crear paciente: ${error.message}`);
      
      // Log detallado de la respuesta de Dentalink
      if (error.response) {
        this.logger.error(`📊 Status Code: ${error.response.status}`);
        this.logger.error(`📄 Respuesta de Dentalink: ${JSON.stringify(error.response.data)}`);
        this.logger.error(`📤 Payload enviado: ${JSON.stringify(payloadPaciente)}`);
        
        throw new HttpException(
          error.response.data?.message || error.response.data || 'Error al crear paciente en Dentalink',
          error.response.status || HttpStatus.BAD_REQUEST,
        );
      }
      
      throw new HttpException(
        `Error de conexión: ${error.message}`,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Agenda una cita en Dentalink y opcionalmente integra con GHL
   */
  async scheduleAppointment(clientId: string, params: ScheduleAppointmentDto): Promise<any> {
    this.logger.log(`📅 Agendando cita para paciente ${params.id_paciente} con profesional ${params.id_profesional}`);

    const client = await this.clientsService.findOne(clientId);
    const apiKey = client.apiKey;
    const timezone = client.timezone;
    const baseURL = process.env.DENTALINK_BASE_URL || 'https://api.dentalink.healthatom.com/api/v1/';

    const headers = {
      Authorization: `Token ${apiKey}`,
      'Content-Type': 'application/json',
    };

    // Obtener intervalo del profesional
    let duracion = params.tiempo_cita;
    let intervaloProfesional: number | null = null;

    try {
      const profResp = await axios.get(`${baseURL}dentistas`, { headers });
      if (profResp.status === 200) {
        const dentistas = profResp.data?.data || [];
        const dentista = dentistas.find((d: any) => d.id === params.id_profesional);
        if (dentista) {
          intervaloProfesional = dentista.intervalo;
        }
      }
    } catch (error) {
      this.logger.warn(`⚠️ No se pudo obtener intervalo del profesional: ${error.message}`);
    }

    // Determinar duración
    if (!duracion) {
      if (intervaloProfesional) {
        duracion = intervaloProfesional;
      } else {
        throw new HttpException(
          'No se pudo determinar la duración de la cita. Especifica tiempo_cita o verifica que el profesional tenga intervalo configurado.',
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    // Crear payload de cita
    const payloadCita = {
      id_dentista: params.id_profesional,
      id_sucursal: params.id_sucursal,
      id_estado: 7, // Confirmado
      id_sillon: 1,
      id_paciente: params.id_paciente,
      fecha: params.fecha,
      hora_inicio: params.hora_inicio,
      duracion,
      comentario: params.comentario || 'Cita agendada por Sistema',
    };

    this.logger.log(`📤 Payload enviado a Dentalink: ${JSON.stringify(payloadCita)}`);

    try {
      const response = await axios.post(`${baseURL}citas/`, payloadCita, { headers });

      if (response.status === 201) {
        const citaData = response.data?.data || {};
        const idCita = citaData.id;

        this.logger.log(`✅ Cita creada exitosamente con ID ${idCita}`);

        // Integración con GHL (si está habilitado y se proporcionó userId)
        if (client.ghlEnabled && params.userId) {
          this.logger.log('🔗 Iniciando integración con GHL en background...');
          
          // Ejecutar en background sin bloquear respuesta
          setImmediate(async () => {
            try {
              await this.ghlService.integrarCita(
                {
                  accessToken: client.ghlAccessToken,
                  calendarId: client.ghlCalendarId,
                  locationId: client.ghlLocationId,
                },
                {
                  userId: params.userId,
                  fecha: params.fecha,
                  hora_inicio: params.hora_inicio,
                  duracion,
                  id_profesional: params.id_profesional,
                  id_sucursal: params.id_sucursal,
                  comentario: params.comentario,
                },
                baseURL,
                headers,
                timezone,
              );
            } catch (error) {
              this.logger.error(`Error integrando con GHL: ${error.message}`);
              // No fallar la cita si GHL falla
            }
          });
        }

        return {
          id_cita: idCita,
          mensaje: 'Cita agendada exitosamente',
        };
      } else {
        throw new HttpException(
          `Error al crear cita: ${response.data}`,
          HttpStatus.BAD_REQUEST,
        );
      }
    } catch (error) {
      this.logger.error(`❌ Error al agendar cita: ${error.message}`);
      
      // Log detallado de la respuesta de Dentalink
      if (error.response) {
        this.logger.error(`📊 Status Code: ${error.response.status}`);
        this.logger.error(`📄 Respuesta de Dentalink: ${JSON.stringify(error.response.data)}`);
        this.logger.error(`📤 Payload enviado: ${JSON.stringify(payloadCita)}`);
        
        throw new HttpException(
          error.response.data?.message || error.response.data || 'Error al agendar cita en Dentalink',
          error.response.status || HttpStatus.BAD_REQUEST,
        );
      }
      
      throw new HttpException(
        `Error de conexión: ${error.message}`,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Cancela una cita por ID o por RUT (cancela la próxima futura)
   */
  async cancelAppointment(clientId: string, params: CancelAppointmentDto): Promise<any> {
    this.logger.log(`❌ Cancelando cita - ID Cita: ${params.id_cita}`);

    const client = await this.clientsService.findOne(clientId);
    return await this.cancelarCitaPorId(client.apiKey, params.id_cita);
  }

  private async cancelarCitaPorId(apiKey: string, idCita: number): Promise<any> {
    const baseURL = process.env.DENTALINK_BASE_URL || 'https://api.dentalink.healthatom.com/api/v1/';
    const headers = {
      Authorization: `Token ${apiKey}`,
      'Content-Type': 'application/json',
    };

    try {
      const urlCita = `${baseURL}citas/${idCita}`;

      // Obtener datos de la cita primero
      const respGet = await axios.get(urlCita, { headers });
      if (respGet.status !== 200) {
        throw new HttpException(
          `No se encontró la cita con ID ${idCita}`,
          HttpStatus.NOT_FOUND,
        );
      }

      const citaData = respGet.data?.data || {};

      // Preparar payload de cancelación
      const payloadCancelar = {
        id_estado: 1, // Estado anulado
        comentarios: 'Cita cancelada por sistema',
        flag_notificar_anulacion: 1,
      };

      // Cancelar cita
      const respCancel = await axios.put(urlCita, payloadCancelar, { headers });

      if (respCancel.status === 200) {
        this.logger.log(`✅ Cita ${idCita} cancelada`);
        return {
          mensaje: 'Cita cancelada exitosamente',
          id_cita: idCita,
          fecha: citaData.fecha,
          hora_inicio: citaData.hora_inicio,
        };
      } else {
        throw new HttpException(
          `Error al cancelar cita: ${respCancel.data}`,
          HttpStatus.BAD_REQUEST,
        );
      }
    } catch (error) {
      this.logger.warn(`⚠️ Error cancelando cita: ${error.message}`);
      throw new HttpException(
        `Error de conexión: ${error.message}`,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Obtiene los tratamientos de un paciente por RUT
   */
  async getPatientTreatments(clientId: string, params: GetTreatmentsDto): Promise<any> {
    this.logger.log(`🔍 Buscando tratamientos para paciente con RUT: ${params.rut}`);

    const client = await this.clientsService.findOne(clientId);
    const apiKey = client.apiKey;
    const baseURL = process.env.DENTALINK_BASE_URL || 'https://api.dentalink.healthatom.com/api/v1/';

    const rutFormateado = formatearRut(params.rut);
    const headers = {
      Authorization: `Token ${apiKey}`,
      'Content-Type': 'application/json',
    };

    try {
      // 1. Buscar paciente por RUT
      const filtro = JSON.stringify({ rut: { eq: rutFormateado } });
      this.logger.log(`🔍 Buscando paciente en ${baseURL}pacientes`);

      const respPaciente = await axios.get(`${baseURL}pacientes`, {
        headers,
        params: { q: filtro },
      });

      this.logger.log(`📊 Status búsqueda paciente: ${respPaciente.status}`);

      if (respPaciente.status !== 200) {
        throw new HttpException(
          `Error al buscar paciente: ${respPaciente.data}`,
          HttpStatus.BAD_REQUEST,
        );
      }

      const pacientesData = respPaciente.data?.data || [];
      if (pacientesData.length === 0) {
        throw new HttpException(
          `Paciente con RUT ${rutFormateado} no encontrado`,
          HttpStatus.NOT_FOUND,
        );
      }

      const paciente = pacientesData[0];
      const idPaciente = paciente.id;
      const nombreCompleto = `${paciente.nombre || ''} ${paciente.apellidos || ''}`.trim();

      this.logger.log(`✅ Paciente encontrado: ${nombreCompleto} (ID: ${idPaciente})`);

      // 2. Buscar link de tratamientos
      let tratamientosLink = paciente.links?.find((l: any) => l.rel === 'tratamientos')?.href;

      if (!tratamientosLink) {
        // Construir URL manualmente
        this.logger.warn('⚠️ Link de tratamientos no encontrado, construyendo URL manualmente');
        tratamientosLink = `${baseURL}pacientes/${idPaciente}/tratamientos`;
      }

      this.logger.log(`🔗 Consultando tratamientos: ${tratamientosLink}`);

      // 3. Obtener tratamientos
      const respTratamientos = await axios.get(tratamientosLink, { headers });
      this.logger.log(`📊 Status tratamientos: ${respTratamientos.status}`);

      if (respTratamientos.status !== 200) {
        throw new HttpException(
          `Error al obtener tratamientos: ${respTratamientos.data}`,
          HttpStatus.BAD_REQUEST,
        );
      }

      const tratamientosData = respTratamientos.data?.data || [];
      this.logger.log(`📋 Tratamientos encontrados: ${tratamientosData.length}`);

      // 4. Filtrar campos relevantes
      const tratamientosFiltrados = tratamientosData.map((tratamiento: any) => ({
        id: tratamiento.id,
        fecha: tratamiento.fecha,
        id_dentista: tratamiento.id_dentista,
        nombre_dentista: tratamiento.nombre_dentista,
        id_sucursal: tratamiento.id_sucursal,
        nombre_sucursal: tratamiento.nombre_sucursal,
        finalizado: tratamiento.finalizado,
      }));

      // 5. Preparar respuesta
      return {
        paciente: {
          id: idPaciente,
          nombre: nombreCompleto,
          rut: rutFormateado,
        },
        tratamientos: tratamientosFiltrados,
        total_tratamientos: tratamientosFiltrados.length,
      };
    } catch (error) {
      this.logger.error(`❌ Error obteniendo tratamientos: ${error.message}`);
      throw new HttpException(
        `Error de conexión: ${error.message}`,
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
