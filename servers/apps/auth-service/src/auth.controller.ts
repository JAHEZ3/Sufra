import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";
import { EventPattern, Payload } from "@nestjs/microservices";
import { AuthService } from "./auth.service";
import {
  RegisterCustomerDto,
  RegisterDeliveryDto,
  RegisterRestaurantDto,
} from "./dto/register.dto";
import { ResendOtpDto, VerifyOtpDto } from "./dto/verify-otp.dto";
import {
  DeliveryLoginOtpDto,
  LoginCustomerDto,
  LoginDeliveryDto,
  LoginManagerDto,
  LoginRestaurantDto,
} from "./dto/login.dto";
import { RefreshTokenDto } from "./dto/refresh-token.dto";
import { ForgotPasswordDto } from "./dto/forgot-password.dto";
import { ResetPasswordDto } from "./dto/reset-password.dto";
import { ChangePasswordDto } from "./dto/change-password.dto";
import { AdminListUsersDto } from "./dto/admin-list-users.dto";
import { AdminUpdateUserDto } from "./dto/admin-update-user.dto";
import { AdminChangeStatusDto } from "./dto/admin-change-status.dto";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { RolesGuard } from "./guards/roles.guard";
import { Roles } from "./decorators/roles.decorator";
import { CurrentUser } from "./decorators/current-user.decorator";

@Controller()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  private sessionContext(req: Request) {
    const ua = req.headers["user-agent"];
    return {
      ip: req.ip,
      ...(typeof ua === "string" && { userAgent: ua }),
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // REGISTRATION  —  Step 1: phone → OTP (status: PENDING)
  // ═══════════════════════════════════════════════════════════════════════════

  @Post("customer/register")
  registerCustomer(@Body() dto: RegisterCustomerDto) {
    return this.authService.registerCustomer(dto);
  }

  @Post("delivery/register")
  registerDelivery(@Body() dto: RegisterDeliveryDto) {
    return this.authService.registerDelivery(dto);
  }

  @Post("restaurant/register")
  registerRestaurant(@Body() dto: RegisterRestaurantDto, @Req() req: Request) {
    return this.authService.registerRestaurant(dto, this.sessionContext(req));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // REGISTRATION  —  Step 2: verify OTP (status: SUSPENDED + tokens issued)
  // ═══════════════════════════════════════════════════════════════════════════

  /** Verifies the PHONE_VERIFY OTP for any phone-based role. */
  @Post("verify-otp")
  verifyOtp(@Body() dto: VerifyOtpDto, @Req() req: Request) {
    return this.authService.verifyRegistrationOtp(dto, this.sessionContext(req));
  }

  /** Resends PHONE_VERIFY OTP (max 3 / 24 h). */
  @Post("resend-otp")
  resendOtp(@Body() dto: ResendOtpDto) {
    return this.authService.resendOtp(dto);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LOGIN
  // ═══════════════════════════════════════════════════════════════════════════

  /** Step 1 of customer OTP login — sends a LOGIN OTP. */
  @Post("customer/login")
  loginCustomer(@Body() dto: LoginCustomerDto) {
    return this.authService.loginCustomer(dto);
  }

  /** Step 2 of customer OTP login — verifies OTP and returns tokens. */
  @Post("customer/verify-login")
  verifyLoginOtp(@Body() dto: VerifyOtpDto, @Req() req: Request) {
    return this.authService.verifyLoginOtp(dto, this.sessionContext(req));
  }

  @Post("delivery/login")
  loginDelivery(@Body() dto: LoginDeliveryDto, @Req() req: Request) {
    return this.authService.loginDelivery(dto, this.sessionContext(req));
  }

  /**
   * OTP-login fallback for drivers with no password yet (phone verified but
   * application form not submitted). Step 1: send a login OTP.
   */
  @Post("delivery/login-otp")
  sendDeliveryLoginOtp(@Body() dto: DeliveryLoginOtpDto) {
    return this.authService.sendDeliveryLoginOtp(dto);
  }

  /** Step 2 of the driver OTP-login fallback — verify OTP and return tokens. */
  @Post("delivery/verify-login")
  verifyDeliveryLoginOtp(@Body() dto: VerifyOtpDto, @Req() req: Request) {
    return this.authService.verifyDeliveryLoginOtp(dto, this.sessionContext(req));
  }

  @Post("restaurant/login")
  loginRestaurant(@Body() dto: LoginRestaurantDto, @Req() req: Request) {
    return this.authService.loginRestaurant(dto, this.sessionContext(req));
  }

  @Post("manager/login")
  loginManager(@Body() dto: LoginManagerDto, @Req() req: Request) {
    return this.authService.loginManager(dto, this.sessionContext(req));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PASSWORD MANAGEMENT  (delivery / restaurant / manager only)
  // ═══════════════════════════════════════════════════════════════════════════

  @Post("forgot-password")
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Post("reset-password")
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @Post("change-password")
  @UseGuards(JwtAuthGuard)
  changePassword(
    @CurrentUser("sub") userId: string,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(userId, dto);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TOKEN MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  @Post("refresh")
  refresh(@Body() dto: RefreshTokenDto, @Req() req: Request) {
    return this.authService.refresh(dto.refreshToken, this.sessionContext(req));
  }

  @Delete("logout")
  @UseGuards(JwtAuthGuard)
  logout(@CurrentUser("sub") userId: string, @Body() dto: RefreshTokenDto) {
    return this.authService.logout(userId, dto.refreshToken);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SESSIONS  —  list / revoke active refresh-token sessions
  // ═══════════════════════════════════════════════════════════════════════════

  /** GET /api/auth/sessions?refreshToken=...  (refreshToken optional; used to mark the current session) */
  @Get("sessions")
  @UseGuards(JwtAuthGuard)
  listSessions(
    @CurrentUser("sub") userId: string,
    @Query("refreshToken") refreshToken?: string,
  ) {
    return this.authService.listSessions(userId, refreshToken);
  }

  /** DELETE /api/auth/sessions/:id — revoke one session by its jti. */
  @Delete("sessions/:id")
  @UseGuards(JwtAuthGuard)
  revokeSession(
    @CurrentUser("sub") userId: string,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.authService.revokeSession(userId, id);
  }

  /** DELETE /api/auth/sessions — revoke all sessions EXCEPT the one owning the passed refresh token. */
  @Delete("sessions")
  @UseGuards(JwtAuthGuard)
  revokeOtherSessions(
    @CurrentUser("sub") userId: string,
    @Body() dto: RefreshTokenDto,
  ) {
    return this.authService.revokeOtherSessions(userId, dto.refreshToken);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MANAGER DASHBOARD — User Administration
  // All endpoints require an authenticated manager.
  // ═══════════════════════════════════════════════════════════════════════════

  /** GET /api/auth/manager/users?role=&status=&search=&page=&limit= */
  @Get("manager/users")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("manager")
  adminListUsers(@Query() query: AdminListUsersDto) {
    return this.authService.adminListUsers(query);
  }

  /** GET /api/auth/manager/users/:id */
  @Get("manager/users/:id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("manager")
  adminGetUser(@Param("id", ParseUUIDPipe) id: string) {
    return this.authService.adminGetUser(id);
  }

  /** PATCH /api/auth/manager/users/:id */
  @Patch("manager/users/:id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("manager")
  adminUpdateUser(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: AdminUpdateUserDto,
  ) {
    return this.authService.adminUpdateUser(id, dto);
  }

  /** PATCH /api/auth/manager/users/:id/status */
  @Patch("manager/users/:id/status")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("manager")
  adminChangeStatus(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: AdminChangeStatusDto,
  ) {
    return this.authService.adminChangeStatus(id, dto);
  }

  /** DELETE /api/auth/manager/users/:id */
  @Delete("manager/users/:id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("manager")
  adminDeleteUser(@Param("id", ParseUUIDPipe) id: string) {
    return this.authService.adminDeleteUser(id);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // NATS EVENT HANDLERS
  // Each downstream service emits an event when something meaningful happens.
  // Auth-service listens and updates the users table (single source of truth).
  // ═══════════════════════════════════════════════════════════════════════════

  /** customer-service → profile saved → user ACTIVE */
  @EventPattern("customer.profile.completed")
  onCustomerProfileCompleted(@Payload() data: { userId: string }) {
    return this.authService.onCustomerProfileCompleted(data);
  }

  /** delivery-service → agent submitted application → profileCompleted = true */
  @EventPattern("delivery.profile.completed")
  onDeliveryProfileCompleted(@Payload() data: { userId: string }) {
    return this.authService.onDeliveryProfileCompleted(data);
  }

  /** delivery-service → manager approved agent → user ACTIVE */
  @EventPattern("delivery.agent.approved")
  onDeliveryAgentApproved(@Payload() data: { userId: string }) {
    return this.authService.onDeliveryAgentApproved(data);
  }

  /** delivery-service → manager rejected agent → profileCompleted reset */
  @EventPattern("delivery.agent.rejected")
  onDeliveryAgentRejected(@Payload() data: { userId: string }) {
    return this.authService.onDeliveryAgentRejected(data);
  }

  /** restaurant-service → owner saved profile → profileCompleted = true */
  @EventPattern("restaurant.profile.completed")
  onRestaurantProfileCompleted(@Payload() data: { userId: string }) {
    return this.authService.onRestaurantProfileCompleted(data);
  }

  /** restaurant-service → manager approved restaurant → user ACTIVE */
  @EventPattern("restaurant.owner.approved")
  onRestaurantOwnerApproved(@Payload() data: { userId: string }) {
    return this.authService.onRestaurantOwnerApproved(data);
  }

  /** restaurant-service → manager rejected restaurant → profileCompleted reset */
  @EventPattern("restaurant.owner.rejected")
  onRestaurantOwnerRejected(@Payload() data: { userId: string }) {
    return this.authService.onRestaurantOwnerRejected(data);
  }

  /** delivery-service or restaurant-service → password set for user */
  @EventPattern("user.password.set")
  onPasswordSet(@Payload() data: { userId: string; password: string }) {
    return this.authService.onPasswordSet(data);
  }
}
