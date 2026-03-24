from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Response, status
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.session import get_db
from app.schemas.auth import (
    AuthFallbackDTO,
    AuthResponseDTO,
    AuthTokensDTO,
    LoginRequest,
    RefreshRequest,
    SignupRequest,
    UserDTO,
)
from app.services.auth_service import AuthError, AuthService

router = APIRouter(prefix="/auth", tags=["auth"])


def get_auth_service(db: Session = Depends(get_db)) -> AuthService:
    return AuthService(db=db, settings=get_settings())


def _raise_http(err: AuthError) -> None:
    raise HTTPException(
        status_code=err.status_code, detail={"code": err.code, "message": err.message}
    )


@router.post(
    "/signup", response_model=AuthResponseDTO, status_code=status.HTTP_201_CREATED
)
def signup(
    payload: SignupRequest, service: Annotated[AuthService, Depends(get_auth_service)]
):
    try:
        return service.signup(email=payload.email, password=payload.password)
    except AuthError as err:
        _raise_http(err)


@router.post("/login", response_model=AuthResponseDTO)
def login(
    payload: LoginRequest, service: Annotated[AuthService, Depends(get_auth_service)]
):
    try:
        return service.login(email=payload.email, password=payload.password)
    except AuthError as err:
        _raise_http(err)


@router.post("/refresh", response_model=AuthTokensDTO)
def refresh(
    payload: RefreshRequest, service: Annotated[AuthService, Depends(get_auth_service)]
):
    try:
        return service.refresh(refresh_token=payload.refresh_token)
    except AuthError as err:
        _raise_http(err)


@router.get("/me")
def me(
    service: Annotated[AuthService, Depends(get_auth_service)],
    authorization: Annotated[str | None, Header()] = None,
):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token"
        )

    token = authorization.split(" ", 1)[1]
    try:
        user: UserDTO = service.get_current_user(access_token=token)
        return {"user": user.model_dump()}
    except AuthError as err:
        _raise_http(err)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    payload: RefreshRequest, service: Annotated[AuthService, Depends(get_auth_service)]
):
    try:
        service.logout(refresh_token=payload.refresh_token)
    except AuthError as err:
        _raise_http(err)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/google/start")
def google_start(service: Annotated[AuthService, Depends(get_auth_service)]):
    try:
        auth_url = service.get_google_auth_url()
        return {"authUrl": auth_url}
    except AuthError as err:
        if err.code == "google_unavailable":
            return Response(
                content=AuthFallbackDTO(
                    fallback="email_password", reason="google_unavailable"
                ).model_dump_json(),
                media_type="application/json",
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        _raise_http(err)


@router.get("/google/callback")
def google_callback(
    service: Annotated[AuthService, Depends(get_auth_service)],
    code: Annotated[str, Query()],
    state: Annotated[str, Query()],
):
    try:
        return service.exchange_google_callback(code=code, state=state)
    except AuthError as err:
        if err.code == "google_unavailable":
            return Response(
                content=AuthFallbackDTO(
                    fallback="email_password", reason="google_unavailable"
                ).model_dump_json(),
                media_type="application/json",
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        _raise_http(err)
