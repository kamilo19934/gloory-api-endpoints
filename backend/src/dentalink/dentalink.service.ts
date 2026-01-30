import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { ClientsService } from '../clients/clients.service';
import { GHLService } from './ghl.service';
import { HealthAtomService } from '../integrations/healthatom/healthatom.service';
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
    private readonly healthAtomService: HealthAtomService,
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
    
    // Detectar tipo de integración
    const dentalinkIntegration = client.getIntegration('dentalink');
    const medilinkIntegration = client.getIntegration('medilink');
    const dualIntegration = client.getIntegration('dentalink_medilink');
    
    let baseURL = process.env.DENTALINK_BASE_URL || 'https://api.dentalink.healthatom.com/api/v1/';
    let apiType = 'dentalink'; // default
    
    if (medilinkIntegration) {
      baseURL = 'https://api.medilink2.healthatom.com/api/v5/';
      apiType = 'medilink';
      this.logger.log('🔵 Usando API Medilink');
    } else if (dualIntegration) {
      // Intentar Dentalink primero, luego Medilink
      apiType = 'dual';
      this.logger.log('🔵 Modo dual: intentará Dentalink y Medilink');
    } else {
      this.logger.log('🔵 Usando API Dentalink');
    }

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
      
      if (apiType === 'medilink') {
        // Medilink: usar endpoint v6/profesionales/{id} para cada profesional
        for (const idProf of params.ids_profesionales) {
          try {
            // Medilink usa v6 para el endpoint de profesionales
            const profResp = await axios.get(
              `https://api.medilink2.healthatom.com/api/v6/profesionales/${idProf}`, 
              { headers }
            );
            if (profResp.status === 200) {
              const profesional = profResp.data?.data;
              if (profesional) {
                const apellido = profesional.apellidos || profesional.apellido || '';
                const nombreCompleto = `${profesional.nombre || 'Desconocido'} ${apellido}`.trim();
                const intervalo = profesional.intervalo;
                
                profesionalesInfo[idProf] = nombreCompleto;
                if (intervalo) {
                  profesionalesIntervalos[idProf] = intervalo;
                  this.logger.log(`✅ Profesional Medilink: ID ${idProf} - ${nombreCompleto} (Intervalo: ${intervalo} min)`);
                } else {
                  this.logger.warn(`⚠️ Profesional ID ${idProf} sin intervalo configurado`);
                }
              }
            }
          } catch (error) {
            this.logger.warn(`⚠️ No se pudo obtener profesional ${idProf} de Medilink: ${error.message}`);
          }
        }
      } else if (apiType === 'dual') {
        // Modo dual: intentar obtener de ambas APIs
        // Primero intentar Dentalink
        try {
          const profResp = await axios.get(`https://api.dentalink.healthatom.com/api/v1/dentistas`, { headers });
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
                  this.logger.log(`✅ Profesional Dentalink: ID ${dentista.id} - ${nombreCompleto} (Intervalo: ${intervalo} min)`);
                }
              }
            }
          }
        } catch (error) {
          this.logger.warn(`⚠️ Error obteniendo dentistas de Dentalink: ${error.message}`);
        }
        
        // Luego buscar los faltantes en Medilink
        const idsFaltantes = params.ids_profesionales.filter(id => !profesionalesInfo[id]);
        for (const idProf of idsFaltantes) {
          try {
            const profResp = await axios.get(
              `https://api.medilink2.healthatom.com/api/v6/profesionales/${idProf}`, 
              { headers }
            );
            if (profResp.status === 200) {
              const profesional = profResp.data?.data;
              if (profesional) {
                const apellido = profesional.apellidos || profesional.apellido || '';
                const nombreCompleto = `${profesional.nombre || 'Desconocido'} ${apellido}`.trim();
                const intervalo = profesional.intervalo;
                
                profesionalesInfo[idProf] = nombreCompleto;
                if (intervalo) {
                  profesionalesIntervalos[idProf] = intervalo;
                  this.logger.log(`✅ Profesional Medilink (fallback): ID ${idProf} - ${nombreCompleto} (Intervalo: ${intervalo} min)`);
                }
              }
            }
          } catch (error) {
            this.logger.warn(`⚠️ No se pudo obtener profesional ${idProf} de Medilink: ${error.message}`);
          }
        }
      } else {
        // Solo Dentalink
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
                this.logger.log(`✅ Profesional Dentalink: ID ${dentista.id} - ${nombreCompleto} (Intervalo: ${intervalo} min)`);
              } else {
                this.logger.warn(`⚠️ Profesional ID ${dentista.id} sin intervalo configurado`);
              }
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

      // Preparar body JSON según el tipo de API
      let bodyData: any;
      if (apiType === 'medilink') {
        bodyData = {
          ids_profesional: params.ids_profesionales,
          id_sucursal: params.id_sucursal,
          fecha_inicio: fechaInicio.format('YYYY-MM-DD'),
          fecha_fin: fechaFin.format('YYYY-MM-DD'),
        };
      } else {
        bodyData = {
          ids_dentista: params.ids_profesionales,
          id_sucursal: params.id_sucursal,
          fecha_inicio: fechaInicio.format('YYYY-MM-DD'),
          fecha_fin: fechaFin.format('YYYY-MM-DD'),
        };
      }

      this.logger.log(`📋 Body JSON enviado: ${JSON.stringify(bodyData)}`);

      let response = null;
      let urlUsado = null;
      let apiUsada = null;

      // Si es modo dual, intentar ambas APIs
      const apisToTry = apiType === 'dual' 
        ? [
            { type: 'dentalink', baseUrl: 'https://api.dentalink.healthatom.com/api/v1/', paramKey: 'ids_dentista' },
            { type: 'medilink', baseUrl: 'https://api.medilink2.healthatom.com/api/v5/', paramKey: 'ids_profesional' }
          ]
        : [{ type: apiType, baseUrl: baseURL, paramKey: apiType === 'medilink' ? 'ids_profesional' : 'ids_dentista' }];

      for (const api of apisToTry) {
        const urlsToTry = [`${api.baseUrl}horariosdisponibles/`, `${api.baseUrl}horariosdisponibles`];
        
        // Preparar datos según el tipo de API
        const requestData = {
          ...bodyData,
          [api.paramKey]: params.ids_profesionales,
        };
        delete requestData.ids_dentista;
        delete requestData.ids_profesional;
        requestData[api.paramKey] = params.ids_profesionales;

        this.logger.log(`🔍 Intentando API ${api.type.toUpperCase()} con parámetro ${api.paramKey}`);

        for (const url of urlsToTry) {
          try {
            this.logger.log(`🌐 Intentando URL: ${url}`);
            
            // Dentalink y MediLink usan GET pero de forma diferente:
            // - Dentalink: GET con body (en campo 'data')
            // - MediLink: GET con query parameters
            if (api.type === 'dentalink') {
              // Dentalink: GET con body en el campo 'data'
              this.logger.log(`📋 Dentalink - Enviando body en GET: ${JSON.stringify(requestData)}`);
              response = await axios.get(url, { 
                headers,
                data: requestData  // Body en GET para Dentalink
              });
            } else {
              // MediLink: GET con query parameters
              const queryParams = new URLSearchParams();
              params.ids_profesionales.forEach((id: number) => 
                queryParams.append('ids_profesional[]', id.toString())
              );
              queryParams.append('id_sucursal', params.id_sucursal.toString());
              queryParams.append('fecha_inicio', requestData.fecha_inicio);
              queryParams.append('fecha_fin', requestData.fecha_fin);
              
              this.logger.log(`📋 MediLink - Enviando query params: ${queryParams.toString()}`);
              response = await axios.get(`${url}?${queryParams.toString()}`, { headers });
            }
            
            this.logger.log(`📊 Status Code: ${response.status}`);

            if (response.status === 200) {
              urlUsado = url;
              apiUsada = api.type;
              this.logger.log(`✅ Éxito con ${api.type.toUpperCase()}`);
              break;
            }
          } catch (error) {
            const statusCode = error.response?.status;
            const errorMsg = error.response?.data || error.message;
            this.logger.warn(`⚠️ Error con ${url}: ${error.message} (Status: ${statusCode})`);
            if (statusCode && errorMsg) {
              this.logger.warn(`📄 Respuesta del servidor: ${JSON.stringify(errorMsg)}`);
            }
          }
        }

        if (response && response.status === 200) {
          break; // Salir del loop de APIs si ya encontramos una exitosa
        }
      }

      if (!response || response.status !== 200) {
        throw new HttpException(
          `No se pudo conectar con ninguna API disponible. Verifica las credenciales y configuración del cliente.`,
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }

      this.logger.log(`✅ API exitosa: ${apiUsada?.toUpperCase()} - URL: ${urlUsado}`);

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
   * Determina qué APIs usar según el tipo de integración del cliente
   */
  private getApisToUse(client: any): Array<{ type: string; baseUrl: string }> {
    const dentalinkIntegration = client.getIntegration('dentalink');
    const medilinkIntegration = client.getIntegration('medilink');
    const dualIntegration = client.getIntegration('dentalink_medilink');

    if (dualIntegration) {
      // Modo dual: intentar Dentalink primero, luego Medilink
      this.logger.log('🔵 Modo dual: intentará Dentalink y Medilink');
      return [
        { type: 'dentalink', baseUrl: 'https://api.dentalink.healthatom.com/api/v1/' },
        { type: 'medilink', baseUrl: 'https://api.medilink2.healthatom.com/api/v5/' },
      ];
    } else if (medilinkIntegration) {
      // Solo Medilink
      this.logger.log('🔵 Usando API Medilink');
      return [
        { type: 'medilink', baseUrl: 'https://api.medilink2.healthatom.com/api/v5/' },
      ];
    } else {
      // Default: Solo Dentalink
      this.logger.log('🔵 Usando API Dentalink');
      return [
        { type: 'dentalink', baseUrl: process.env.DENTALINK_BASE_URL || 'https://api.dentalink.healthatom.com/api/v1/' },
      ];
    }
  }

  /**
   * Busca un paciente por RUT en Dentalink/Medilink
   */
  async searchUser(clientId: string, params: SearchUserDto): Promise<any> {
    this.logger.log(`🔍 Buscando paciente con RUT: ${params.rut}`);

    const client = await this.clientsService.findOne(clientId);
    const apiKey = client.apiKey;
    const apisToTry = this.getApisToUse(client);

    const rutFormateado = formatearRut(params.rut);
    const headers = {
      Authorization: `Token ${apiKey}`,
      'Content-Type': 'application/json',
    };

    const filtro = JSON.stringify({ rut: { eq: rutFormateado } });
    const errors: string[] = [];

    for (const api of apisToTry) {
      try {
        this.logger.log(`🔍 Buscando paciente en ${api.type.toUpperCase()}: RUT=${rutFormateado}`);

        const response = await axios.get(`${api.baseUrl}pacientes`, {
          headers,
          params: { q: filtro },
        });

        this.logger.log(`📊 Status búsqueda paciente en ${api.type}: ${response.status}`);

        if (response.status === 200) {
          const pacientes = response.data?.data || [];
          if (pacientes.length > 0) {
            const paciente = pacientes[0];
            this.logger.log(`✅ Paciente encontrado en ${api.type.toUpperCase()} con ID ${paciente.id}`);
            return {
              paciente,
            };
          }
        }
      } catch (error) {
        const errorMsg = `${api.type}: ${error.response?.status || error.message}`;
        this.logger.warn(`⚠️ Error al buscar paciente en ${api.type}: ${error.message}`);
        errors.push(errorMsg);
      }
    }

    throw new HttpException(
      `Paciente con RUT ${rutFormateado} no encontrado`,
      HttpStatus.NOT_FOUND,
    );
  }

  /**
   * Crea un nuevo paciente en Dentalink/Medilink
   */
  async createUser(clientId: string, params: CreateUserDto): Promise<any> {
    this.logger.log(`👤 Creando paciente: ${params.nombre} ${params.apellidos}`);

    const client = await this.clientsService.findOne(clientId);
    const apiKey = client.apiKey;
    const apisToTry = this.getApisToUse(client);

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

    let lastError: string | null = null;

    for (const api of apisToTry) {
      try {
        this.logger.log(`📤 Intentando crear paciente en ${api.type.toUpperCase()}: ${JSON.stringify(payloadPaciente)}`);

        const response = await axios.post(`${api.baseUrl}pacientes/`, payloadPaciente, { headers });

        if (response.status === 201) {
          const pacienteData = response.data?.data || {};
          const idPaciente = pacienteData.id;
          this.logger.log(`✅ Paciente creado exitosamente en ${api.type.toUpperCase()} con ID ${idPaciente}`);
          return {
            id_paciente: idPaciente,
            mensaje: 'Paciente creado exitosamente',
          };
        }
      } catch (error) {
        const errorStatus = error.response?.status;
        const errorData = error.response?.data;
        const apiErrorMessage = this.extractApiErrorMessage(error);
        
        this.logger.warn(`⚠️ Error al crear paciente en ${api.type}: ${apiErrorMessage}`);
        
        // Si es error 400 con mensaje de "existe", buscar el paciente
        if (errorStatus === 400 && errorData?.message?.toLowerCase().includes('existe')) {
          this.logger.log(`⚠️ Paciente ya existe en ${api.type}, buscando...`);
          try {
            const pacienteExistente = await this.searchUser(clientId, { rut: rutFormateado });
            if (pacienteExistente.paciente) {
              return {
                id_paciente: pacienteExistente.paciente.id,
                mensaje: 'Paciente ya existía',
              };
            }
          } catch (searchError) {
            // Continuar con el siguiente intento
          }
        }
        
        // Si es error 412 (sucursal incompatible), continuar con la siguiente API
        if (errorStatus === 412) {
          this.logger.warn(`⚠️ ${api.type} incompatible (412), intentando siguiente API...`);
          continue;
        }

        // Si es error de negocio (400), guardar el mensaje y no continuar
        if (errorStatus === 400) {
          lastError = apiErrorMessage;
          break;
        }
        
        lastError = apiErrorMessage;
        
        // Log detallado
        if (error.response) {
          this.logger.error(`📊 Status Code: ${errorStatus}`);
          this.logger.error(`📄 Respuesta de ${api.type}: ${JSON.stringify(errorData)}`);
        }
      }
    }

    // Si llegamos aquí, falló en todas las APIs
    throw new HttpException(
      lastError || 'No se pudo crear el paciente',
      HttpStatus.BAD_REQUEST,
    );
  }

  /**
   * Extrae el mensaje de error real de la respuesta de la API
   */
  private extractApiErrorMessage(error: any): string {
    const responseData = error.response?.data;
    
    if (responseData) {
      // Formato: { error: { message: "..." } }
      if (responseData.error?.message) {
        return responseData.error.message;
      }
      // Formato: { message: "..." }
      if (responseData.message) {
        return responseData.message;
      }
      // Formato: { error: "..." }
      if (typeof responseData.error === 'string') {
        return responseData.error;
      }
      // Si es un string directo
      if (typeof responseData === 'string') {
        return responseData;
      }
    }
    
    return error.message || 'Error desconocido';
  }

  /**
   * Agenda una cita en Dentalink/Medilink y opcionalmente integra con GHL
   */
  async scheduleAppointment(clientId: string, params: ScheduleAppointmentDto): Promise<any> {
    this.logger.log(`📅 Agendando cita para paciente ${params.id_paciente} con profesional ${params.id_profesional}`);

    const client = await this.clientsService.findOne(clientId);
    const apiKey = client.apiKey;
    const timezone = client.timezone;
    const apisToTry = this.getApisToUse(client);

    const headers = {
      Authorization: `Token ${apiKey}`,
      'Content-Type': 'application/json',
    };

    // Obtener intervalo del profesional (intentar en las APIs disponibles)
    let duracion = params.tiempo_cita;
    let intervaloProfesional: number | null = null;

    for (const api of apisToTry) {
      if (intervaloProfesional) break;
      
      try {
        if (api.type === 'dentalink') {
          // Dentalink: obtener lista de dentistas y buscar por ID
          const profResp = await axios.get(`${api.baseUrl}dentistas`, { headers });
          if (profResp.status === 200) {
            const profesionales = profResp.data?.data || [];
            const profesional = profesionales.find((p: any) => p.id === params.id_profesional);
            if (profesional?.intervalo) {
              intervaloProfesional = profesional.intervalo;
              this.logger.log(`✅ Intervalo obtenido de ${api.type}: ${intervaloProfesional} min`);
            }
          }
        } else {
          // Medilink: usar endpoint v6/profesionales/{id} (no v5)
          const profResp = await axios.get(
            `https://api.medilink2.healthatom.com/api/v6/profesionales/${params.id_profesional}`, 
            { headers }
          );
          if (profResp.status === 200) {
            const profesional = profResp.data?.data;
            if (profesional?.intervalo) {
              intervaloProfesional = profesional.intervalo;
              this.logger.log(`✅ Intervalo obtenido de ${api.type}: ${intervaloProfesional} min`);
            }
          }
        }
      } catch (error) {
        this.logger.warn(`⚠️ No se pudo obtener intervalo del profesional en ${api.type}: ${error.message}`);
      }
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

    let lastError: string | null = null;

    for (const api of apisToTry) {
      try {
        // Crear payload según el tipo de API
        let payloadCita: any;
        
        if (api.type === 'dentalink') {
          payloadCita = {
            id_dentista: params.id_profesional,
            id_sucursal: params.id_sucursal,
            id_estado: 7, // No confirmado
            id_sillon: 1,
            id_paciente: params.id_paciente,
            fecha: params.fecha,
            hora_inicio: params.hora_inicio,
            duracion,
            comentario: params.comentario || 'Agendado por IA',
          };
        } else {
          // Medilink
          payloadCita = {
            id_profesional: params.id_profesional,
            id_sucursal: params.id_sucursal,
            id_estado: 7, // No confirmado
            id_sillon: 1,
            id_paciente: params.id_paciente,
            fecha: params.fecha,
            hora_inicio: params.hora_inicio,
            duracion,
            comentario: params.comentario || 'Agendado por IA',
            videoconsulta: 0, // Presencial por defecto
          };
        }

        this.logger.log(`📤 Intentando agendar en ${api.type.toUpperCase()}: ${JSON.stringify(payloadCita)}`);

        const response = await axios.post(`${api.baseUrl}citas/`, payloadCita, { headers });

        if (response.status === 201) {
          const citaData = response.data?.data || {};
          const idCita = citaData.id;

          this.logger.log(`✅ Cita creada exitosamente en ${api.type.toUpperCase()} con ID ${idCita}`);

          // Integración con GHL (si está habilitado y se proporcionó user_id)
          if (client.ghlEnabled && params.user_id) {
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
                    userId: params.user_id,
                    fecha: params.fecha,
                    hora_inicio: params.hora_inicio,
                    duracion,
                    id_profesional: params.id_profesional,
                    id_sucursal: params.id_sucursal,
                    comentario: params.comentario,
                  },
                  api.baseUrl,
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
        }
      } catch (error) {
        const errorStatus = error.response?.status;
        const errorData = error.response?.data;
        const apiErrorMessage = this.extractApiErrorMessage(error);
        
        this.logger.error(`❌ Error al agendar cita en ${api.type}: ${apiErrorMessage}`);
        
        // Log detallado
        if (error.response) {
          this.logger.error(`📊 Status Code: ${errorStatus}`);
          this.logger.error(`📄 Respuesta de ${api.type}: ${JSON.stringify(errorData)}`);
        }
        
        // Si es error 412 (sucursal incompatible), continuar con la siguiente API
        if (errorStatus === 412) {
          this.logger.warn(`⚠️ ${api.type} incompatible con esta sucursal (412), intentando siguiente API...`);
          continue;
        }
        
        // Si es error de negocio (400), guardar el mensaje y no continuar
        if (errorStatus === 400) {
          lastError = apiErrorMessage;
          break;
        }
        
        lastError = apiErrorMessage;
      }
    }

    // Si llegamos aquí, falló en todas las APIs
    throw new HttpException(
      lastError || 'No se pudo agendar la cita',
      HttpStatus.BAD_REQUEST,
    );
  }

  /**
   * Confirma una cita usando el estado configurado en el cliente
   */
  async confirmAppointment(clientId: string, params: { id_cita: number }): Promise<any> {
    this.logger.log(`✅ Confirmando cita - ID Cita: ${params.id_cita}`);

    const client = await this.clientsService.findOne(clientId);

    // Verificar que el cliente tenga configurado el estado de confirmación
    if (!client.confirmationStateId) {
      throw new HttpException(
        'El cliente no tiene configurado un estado para confirmación de citas. Configure el estado en la configuración del cliente.',
        HttpStatus.BAD_REQUEST,
      );
    }

    // Usar la función centralizada para determinar las APIs
    const apisBase = this.getApisToUse(client);
    const apiKey = client.apiKey;
    
    const headers = {
      Authorization: `Token ${apiKey}`,
      'Content-Type': 'application/json',
    };

    // Agregar commentKey según el tipo de API
    const apisToTry = apisBase.map(api => ({
      ...api,
      commentKey: api.type === 'dentalink' ? 'comentarios' : 'comentario',
    }));

    for (const api of apisToTry) {
      try {
        const urlCita = `${api.baseUrl}citas/${params.id_cita}`;
        
        this.logger.log(`🔍 Intentando confirmar en ${api.type.toUpperCase()}: ${urlCita}`);

        // Verificar que la cita existe
        const respGet = await axios.get(urlCita, { headers });
        if (respGet.status !== 200) {
          continue; // Intentar con la siguiente API
        }

        const citaData = respGet.data?.data || {};
        this.logger.log(`📋 Cita encontrada en ${api.type.toUpperCase()}: Paciente ${citaData.nombre_paciente}, Fecha ${citaData.fecha}, Estado actual: ${citaData.id_estado} (${citaData.estado_cita})`);

        // Validar que el estado de destino sea diferente al actual
        if (citaData.id_estado === client.confirmationStateId) {
          this.logger.log(`⚠️ La cita ya tiene el estado ${client.confirmationStateId}, retornando sin modificar`);
          return {
            mensaje: 'La cita ya está en el estado de confirmación especificado',
            id_cita: params.id_cita,
            fecha: citaData.fecha,
            hora_inicio: citaData.hora_inicio,
            id_estado: client.confirmationStateId,
            paciente: citaData.nombre_paciente,
            ya_confirmada: true,
          };
        }

        // Preparar payload de confirmación - solo el estado, sin comentarios
        const payloadConfirmar: any = {
          id_estado: client.confirmationStateId,
        };

        this.logger.log(`📤 Payload de confirmación: ${JSON.stringify(payloadConfirmar)}`);

        // Confirmar cita
        const respConfirm = await axios.put(urlCita, payloadConfirmar, { headers });

        if (respConfirm.status === 200) {
          this.logger.log(`✅ Cita ${params.id_cita} confirmada exitosamente en ${api.type.toUpperCase()}`);
          return {
            mensaje: 'Cita confirmada exitosamente',
            id_cita: params.id_cita,
            fecha: citaData.fecha,
            hora_inicio: citaData.hora_inicio,
            id_estado: client.confirmationStateId,
            paciente: citaData.nombre_paciente,
          };
        }
      } catch (error) {
        const errorStatus = error.response?.status;
        const errorData = error.response?.data;
        
        this.logger.warn(`⚠️ Error confirmando cita en ${api.type}: ${error.message}`);
        
        // Log detallado para error 400
        if (errorStatus === 400) {
          this.logger.error(`❌ Error 400 en ${api.type}:`);
          this.logger.error(`   - Cita ID: ${params.id_cita}`);
          this.logger.error(`   - Estado solicitado: ${client.confirmationStateId}`);
          this.logger.error(`   - Respuesta del servidor: ${JSON.stringify(errorData)}`);
        }
        
        if (errorStatus === 404) {
          // Cita no encontrada en esta API, intentar con la siguiente
          continue;
        }
        
        // Si es el último intento o un error diferente a 404, lanzar excepción con más detalles
        if (api === apisToTry[apisToTry.length - 1]) {
          const errorMessage = errorData?.message || errorData?.error || error.message;
          const errorDetails = errorData ? ` | Detalles: ${JSON.stringify(errorData)}` : '';
          
          throw new HttpException(
            `Error al confirmar cita en ${api.type}: ${errorMessage}${errorDetails}`,
            errorStatus || HttpStatus.BAD_REQUEST,
          );
        }
      }
    }

    // Si llegamos aquí, la cita no se encontró en ninguna API
    throw new HttpException(
      `No se encontró la cita ${params.id_cita} en ninguna de las APIs disponibles`,
      HttpStatus.NOT_FOUND,
    );
  }

  /**
   * Cancela una cita por ID
   */
  async cancelAppointment(clientId: string, params: CancelAppointmentDto): Promise<any> {
    this.logger.log(`❌ Cancelando cita - ID Cita: ${params.id_cita}`);

    const client = await this.clientsService.findOne(clientId);
    const apisToTry = this.getApisToUse(client);
    
    return await this.cancelarCitaPorId(client.apiKey, params.id_cita, apisToTry);
  }

  private async cancelarCitaPorId(
    apiKey: string, 
    idCita: number, 
    apisToTry: Array<{ type: string; baseUrl: string }>
  ): Promise<any> {
    const headers = {
      Authorization: `Token ${apiKey}`,
      'Content-Type': 'application/json',
    };

    let lastError: string | null = null;
    let citaDataGuardada: any = null;

    for (const api of apisToTry) {
      try {
        const urlCita = `${api.baseUrl}citas/${idCita}`;

        this.logger.log(`🔍 Buscando cita ${idCita} en ${api.type.toUpperCase()}`);

        // Obtener datos de la cita primero
        const respGet = await axios.get(urlCita, { headers });
        
        if (respGet.status !== 200) {
          continue; // Intentar con la siguiente API
        }

        citaDataGuardada = respGet.data?.data || {};
        this.logger.log(`✅ Cita encontrada en ${api.type.toUpperCase()}`);

        // Preparar payload de cancelación según el tipo de API
        let payloadCancelar: any;
        
        if (api.type === 'dentalink') {
          payloadCancelar = {
            id_estado: 1, // Estado anulado
            comentarios: 'Cita cancelada por sistema',
            flag_notificar_anulacion: 1,
          };
        } else {
          // Medilink usa 'comentario' (singular) y no tiene flag_notificar_anulacion
          payloadCancelar = {
            id_estado: 1, // Estado anulado
            comentario: 'Cita cancelada por sistema',
          };
        }

        this.logger.log(`🔄 Intentando cancelar cita en ${api.type.toUpperCase()}`);

        // Cancelar cita
        const respCancel = await axios.put(urlCita, payloadCancelar, { headers });

        if (respCancel.status === 200) {
          this.logger.log(`✅ Cita ${idCita} cancelada exitosamente en ${api.type.toUpperCase()}`);
          return {
            mensaje: 'Cita cancelada exitosamente',
            id_cita: idCita,
            fecha: citaDataGuardada.fecha,
            hora_inicio: citaDataGuardada.hora_inicio,
          };
        }
      } catch (error) {
        const errorStatus = error.response?.status;
        const apiErrorMessage = this.extractApiErrorMessage(error);
        
        this.logger.warn(`⚠️ Error cancelando cita en ${api.type}: ${apiErrorMessage}`);
        
        // Si es 404, la cita no existe en esta API, intentar con la siguiente
        if (errorStatus === 404) {
          continue;
        }
        
        // Si es error de negocio (400), guardar el mensaje y salir
        if (errorStatus === 400) {
          lastError = apiErrorMessage;
          break;
        }
        
        lastError = apiErrorMessage;
      }
    }

    // Si llegamos aquí, no se pudo cancelar en ninguna API
    throw new HttpException(
      lastError || `No se pudo cancelar la cita ${idCita}`,
      HttpStatus.BAD_REQUEST,
    );
  }

  /**
   * Obtiene los tratamientos/atenciones de un paciente por RUT
   */
  async getPatientTreatments(clientId: string, params: GetTreatmentsDto): Promise<any> {
    this.logger.log(`🔍 Buscando tratamientos para paciente con RUT: ${params.rut}`);

    const client = await this.clientsService.findOne(clientId);
    const apiKey = client.apiKey;
    const apisToTry = this.getApisToUse(client);

    const rutFormateado = formatearRut(params.rut);
    const headers = {
      Authorization: `Token ${apiKey}`,
      'Content-Type': 'application/json',
    };

    const filtro = JSON.stringify({ rut: { eq: rutFormateado } });
    const errors: string[] = [];

    for (const api of apisToTry) {
      try {
        this.logger.log(`🔍 Buscando paciente en ${api.type.toUpperCase()}: ${api.baseUrl}pacientes`);

        // 1. Buscar paciente por RUT
        const respPaciente = await axios.get(`${api.baseUrl}pacientes`, {
          headers,
          params: { q: filtro },
        });

        this.logger.log(`📊 Status búsqueda paciente en ${api.type}: ${respPaciente.status}`);

        if (respPaciente.status !== 200) {
          continue;
        }

        const pacientesData = respPaciente.data?.data || [];
        if (pacientesData.length === 0) {
          continue;
        }

        const paciente = pacientesData[0];
        const idPaciente = paciente.id;
        const nombreCompleto = `${paciente.nombre || ''} ${paciente.apellidos || ''}`.trim();

        this.logger.log(`✅ Paciente encontrado en ${api.type.toUpperCase()}: ${nombreCompleto} (ID: ${idPaciente})`);

        // 2. Buscar link de tratamientos/atenciones
        // Dentalink usa 'tratamientos', Medilink usa 'atenciones'
        const relToBuscar = api.type === 'dentalink' ? 'tratamientos' : 'atenciones';
        let tratamientosLink = paciente.links?.find((l: any) => l.rel === relToBuscar)?.href;

        if (!tratamientosLink) {
          // Buscar alternativo si no encuentra el principal
          const relAlternativo = api.type === 'dentalink' ? 'atenciones' : 'tratamientos';
          tratamientosLink = paciente.links?.find((l: any) => l.rel === relAlternativo)?.href;
        }

        if (!tratamientosLink) {
          // Construir URL manualmente
          this.logger.warn(`⚠️ Link de ${relToBuscar} no encontrado, construyendo URL manualmente`);
          tratamientosLink = `${api.baseUrl}pacientes/${idPaciente}/${relToBuscar}`;
        }

        this.logger.log(`🔗 Consultando ${relToBuscar}: ${tratamientosLink}`);

        // 3. Obtener tratamientos/atenciones
        const respTratamientos = await axios.get(tratamientosLink, { headers });
        this.logger.log(`📊 Status ${relToBuscar} en ${api.type}: ${respTratamientos.status}`);

        if (respTratamientos.status !== 200) {
          continue;
        }

        const tratamientosData = respTratamientos.data?.data || [];
        this.logger.log(`📋 ${relToBuscar} encontrados en ${api.type}: ${tratamientosData.length}`);

        // 4. Filtrar campos relevantes según el tipo de API
        const tratamientosFiltrados = tratamientosData.map((tratamiento: any) => {
          if (api.type === 'dentalink') {
            return {
              id: tratamiento.id,
              nombre: tratamiento.nombre,
              fecha: tratamiento.fecha,
              id_dentista: tratamiento.id_dentista,
              nombre_dentista: tratamiento.nombre_dentista,
              id_sucursal: tratamiento.id_sucursal,
              nombre_sucursal: tratamiento.nombre_sucursal,
              finalizado: tratamiento.finalizado,
            };
          } else {
            // Medilink usa id_profesional y nombre_profesional
            return {
              id: tratamiento.id,
              nombre: tratamiento.nombre,
              tipo_atencion: tratamiento.tipo_atencion,
              fecha: tratamiento.fecha,
              id_profesional: tratamiento.id_profesional,
              nombre_profesional: tratamiento.nombre_profesional,
              id_sucursal: tratamiento.id_sucursal,
              nombre_sucursal: tratamiento.nombre_sucursal,
              finalizado: tratamiento.finalizado,
            };
          }
        });

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
        const errorMsg = `${api.type}: ${error.response?.status || error.message}`;
        this.logger.warn(`⚠️ Error obteniendo tratamientos en ${api.type}: ${error.message}`);
        errors.push(errorMsg);
      }
    }

    // Si llegamos aquí, no se encontró en ninguna API
    throw new HttpException(
      `Paciente con RUT ${rutFormateado} no encontrado o sin tratamientos`,
      HttpStatus.NOT_FOUND,
    );
  }

  /**
   * Obtiene todas las citas futuras y activas de un paciente por RUT
   */
  async getFutureAppointments(clientId: string, params: { rut: string }): Promise<any> {
    this.logger.log(`🔎 Obteniendo citas futuras para RUT: ${params.rut}`);

    const client = await this.clientsService.findOne(clientId);

    const result = await this.healthAtomService.getFutureAppointments(params.rut, {
      apiKey: client.apiKey,
      timezone: client.timezone,
    });

    if (!result.success) {
      throw new HttpException(
        result.error || 'Error al obtener citas futuras',
        HttpStatus.BAD_REQUEST,
      );
    }

    this.logger.log(`✅ ${result.data.total_citas} citas futuras obtenidas para RUT ${params.rut}`);

    return result.data;
  }
}
